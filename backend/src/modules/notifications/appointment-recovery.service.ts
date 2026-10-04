import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicPilotService } from '../clinic/clinic-pilot.service';
import { digest, emailMode, encrypt } from './notification-core';

export type RecoveryContext = { sessionId: string; hospitalId: number; appointmentId: number; encounterId: number; contactVersion: number; verifiedAt: Date };
const TEN_MINUTES = 600_000;

@Injectable()
export class AppointmentRecoveryService {
  constructor(private readonly prisma: PrismaService, private readonly pilot: ClinicPilotService) {}

  private async permitted(email: string, reference: string, ip: string): Promise<boolean> {
    const limits = [
      { key: digest('recovery-email:' + email), window: 3600_000, max: 5, cooldown: 0 },
      { key: digest('recovery-ip:' + ip), window: 900_000, max: 10, cooldown: 0 },
      { key: digest('recovery-cooldown:' + email + ':' + reference), window: 3600_000, max: 5, cooldown: 60_000 },
    ].sort((a, b) => a.key.localeCompare(b.key));
    return this.prisma.$transaction(async (tx) => {
      let allowed = true;
      const now = new Date();
      for (const limit of limits) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${limit.key}, 74008))`;
        const old = await tx.recoveryRateLimit.findUnique({ where: { key: limit.key } });
        const withinWindow = old && now.getTime() - old.windowStartAt.getTime() < limit.window;
        if (old && ((withinWindow && old.count >= limit.max) || now.getTime() - old.lastRequestAt.getTime() < limit.cooldown)) allowed = false;
        await tx.recoveryRateLimit.upsert({ where: { key: limit.key }, create: { key: limit.key, count: 1, windowStartAt: now, lastRequestAt: now }, update: { count: withinWindow ? { increment: 1 } : 1, windowStartAt: withinWindow ? old.windowStartAt : now, lastRequestAt: now } });
      }
      return allowed;
    });
  }

  async request(hospitalId: number, reference: string, suppliedEmail: string, ip: string) {
    this.pilot.assertTenantEnabled(hospitalId);
    const email = suppliedEmail.trim().toLowerCase();
    const challengeId = randomUUID();
    const response = { challengeId, message: 'If the visit email and reference match, an access code will arrive shortly.', expiresInSeconds: 600 };
    if (emailMode() === 'disabled' || !await this.permitted(email, reference, ip)) return response;
    const appointment = await this.prisma.clinicAppointment.findFirst({ where: { publicId: reference, hospitalId, encounter: { contact: { email } } }, select: { id: true, encounterId: true } });
    if (!appointment) return response;
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74002, ${appointment.encounterId})`;
      const [settings, contact, current] = await Promise.all([tx.clinicNotificationSettings.findUnique({ where: { hospitalId } }), tx.encounterContact.findUnique({ where: { encounterId: appointment.encounterId } }), tx.clinicAppointment.findUniqueOrThrow({ where: { id: appointment.id }, select: { revision: true } })]);
      if (!settings?.enabled || !contact || contact.email !== email) return;
      await tx.appointmentRecoveryChallenge.updateMany({ where: { hospitalId, appointmentId: appointment.id, usedAt: null }, data: { revokedAt: new Date() } });
      await tx.notificationOutbox.updateMany({ where: { hospitalId, appointmentId: appointment.id, purpose: 'recovery', status: { in: ['QUEUED', 'PROCESSING'] } }, data: { status: 'CANCELLED', secretEncrypted: null, payloadEncrypted: null, cancelledReason: 'challenge_replaced' } });
      await tx.notificationOutbox.updateMany({ where: { hospitalId, appointmentId: appointment.id, purpose: 'recovery' }, data: { secretEncrypted: null, payloadEncrypted: null } });
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const expiresAt = new Date(Date.now() + TEN_MINUTES);
      await tx.appointmentRecoveryChallenge.create({ data: { id: challengeId, hospitalId, appointmentId: appointment.id, contactVersion: contact.version, codeHash: digest('code:' + challengeId + ':' + code), expiresAt } });
      await tx.notificationOutbox.create({ data: { hospitalId, encounterId: appointment.encounterId, appointmentId: appointment.id, challengeId, appointmentRevision: current.revision, contactVersion: contact.version, purpose: 'recovery', recipientEmail: email, dedupeKey: 'recovery:' + challengeId, dueAt: new Date(), expiresAt, secretEncrypted: encrypt(code) } });
    });
    return response;
  }

  async verify(hospitalId: number, challengeId: string, code: string) {
    this.pilot.assertTenantEnabled(hospitalId);
    const found = await this.prisma.appointmentRecoveryChallenge.findFirst({ where: { id: challengeId, hospitalId }, select: { appointment: { select: { encounterId: true } } } });
    if (!found) throw new UnauthorizedException('Invalid or expired access code');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74002, ${found.appointment.encounterId})`;
      const challenge = await tx.appointmentRecoveryChallenge.findUniqueOrThrow({ where: { id: challengeId }, include: { appointment: { include: { encounter: { include: { contact: true } } } } } });
      const now = new Date();
      if (challenge.usedAt || challenge.revokedAt || challenge.expiresAt <= now || challenge.attempts >= 5 || challenge.appointment.encounter.contact?.version !== challenge.contactVersion) return null;
      const matches = timingSafeEqual(Buffer.from(digest('code:' + challengeId + ':' + code), 'hex'), Buffer.from(challenge.codeHash, 'hex'));
      await tx.appointmentRecoveryChallenge.update({ where: { id: challengeId }, data: { attempts: { increment: 1 }, ...(matches ? { usedAt: now } : {}) } });
      if (!matches) {
        if (challenge.attempts >= 4) {
          await tx.notificationOutbox.updateMany({ where: { challengeId, status: { in: ['QUEUED', 'PROCESSING'] }, providerEmailId: null }, data: { status: 'CANCELLED', cancelledReason: 'challenge_attempts_exhausted' } });
          await tx.notificationOutbox.updateMany({ where: { challengeId }, data: { secretEncrypted: null, payloadEncrypted: null } });
        }
        return null;
      }
      const token = randomBytes(32).toString('base64url');
      await tx.appointmentRecoverySession.create({ data: { tokenHash: digest('session:' + token), hospitalId, appointmentId: challenge.appointmentId, contactVersion: challenge.contactVersion, verifiedAt: now, expiresAt: new Date(now.getTime() + 24 * 3600_000) } });
      await tx.encounterContact.update({ where: { encounterId: found.appointment.encounterId }, data: { verifiedAt: now } });
      await tx.notificationOutbox.updateMany({ where: { challengeId }, data: { secretEncrypted: null, payloadEncrypted: null } });
      return { token };
    });
    if (!result) throw new UnauthorizedException('Invalid or expired access code');
    return result;
  }

  async authenticate(token: string | null): Promise<RecoveryContext> {
    if (!token) throw new UnauthorizedException('Verify your visit email to open this appointment');
    const session = await this.prisma.appointmentRecoverySession.findUnique({ where: { tokenHash: digest('session:' + token) }, include: { appointment: { include: { encounter: { select: { contact: { select: { version: true } } } } } } } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.contactVersion !== session.appointment.encounter.contact?.version) throw new UnauthorizedException('Appointment access expired; verify your email again');
    this.pilot.assertTenantEnabled(session.hospitalId);
    return { sessionId: session.id, hospitalId: session.hospitalId, appointmentId: session.appointmentId, encounterId: session.appointment.encounterId, contactVersion: session.contactVersion, verifiedAt: session.verifiedAt };
  }
  async logout(context: RecoveryContext) { await this.prisma.appointmentRecoverySession.update({ where: { id: context.sessionId }, data: { revokedAt: new Date() } }); return { signedOut: true }; }
}
