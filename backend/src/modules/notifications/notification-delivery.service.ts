import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationOutbox, NotificationStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { decrypt, emailMode, EMAIL_RETRY_DELAYS, encrypt, type EmailPayload } from './notification-core';
import { EmailSendError, NotificationProvider } from './notification-provider';

@Injectable()
export class NotificationDeliveryService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService, private readonly provider: NotificationProvider) {}

  private async invalidReason(tx: Prisma.TransactionClient, row: NotificationOutbox, now: Date): Promise<string | null> {
    if (emailMode() === 'disabled') return 'delivery_disabled';
    if (row.expiresAt && row.expiresAt <= now) return 'message_expired';
    if (await tx.notificationSuppression.findUnique({ where: { hospitalId_email: { hospitalId: row.hospitalId, email: row.recipientEmail } } })) return 'recipient_suppressed';
    const settings = await tx.clinicNotificationSettings.findUnique({ where: { hospitalId: row.hospitalId } });
    if (row.purpose !== 'test' && !settings?.enabled) return 'clinic_delivery_disabled';
    if (!row.appointmentId) return row.purpose === 'test' ? null : 'appointment_missing';
    const appointment = await tx.clinicAppointment.findUnique({ where: { id: row.appointmentId }, include: { encounter: { include: { contact: true } } } });
    if (!appointment || appointment.hospitalId !== row.hospitalId || appointment.encounter.contact?.version !== row.contactVersion || appointment.encounter.contact.email !== row.recipientEmail) return 'contact_changed';
    if (row.purpose === 'recovery') {
      const challenge = row.challengeId ? await tx.appointmentRecoveryChallenge.findUnique({ where: { id: row.challengeId } }) : null;
      return !challenge || challenge.usedAt || challenge.revokedAt || challenge.attempts >= 5 || challenge.expiresAt <= now ? 'challenge_expired' : null;
    }
    if (appointment.revision !== row.appointmentRevision) return 'appointment_changed';
    if (['confirmation', 'reminder'].includes(row.purpose) && (appointment.status !== 'CONFIRMED' || appointment.encounter.status !== 'EXPECTED' || appointment.requestedStartAt <= now)) return 'appointment_not_expected';
    if (row.purpose === 'change_pending' && appointment.status !== 'REQUESTED') return 'appointment_changed';
    if (row.purpose === 'cancellation' && !['CANCELLED', 'DECLINED', 'EXPIRED'].includes(appointment.status)) return 'appointment_changed';
    return null;
  }

  async deliverPending(): Promise<void> {
    const now = new Date();
    await this.prisma.notificationOutbox.updateMany({ where: { purpose: 'recovery', expiresAt: { lte: now } }, data: { secretEncrypted: null, payloadEncrypted: null, payload: Prisma.DbNull } });
    await this.prisma.appointmentRecoverySession.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
    await this.prisma.recoveryRateLimit.deleteMany({ where: { lastRequestAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
    if (emailMode() === 'disabled') return;
    const rows = await this.prisma.notificationOutbox.findMany({ where: { OR: [{ status: 'QUEUED', dueAt: { lte: now } }, { status: 'PROCESSING', claimedAt: { lt: new Date(now.getTime() - 120_000) } }] }, orderBy: { dueAt: 'asc' }, select: { id: true, encounterId: true }, take: 25 });
    for (const candidate of rows) await this.deliverOne(candidate.id, candidate.encounterId);
    await this.reconcileReceipts();
  }

  private async deliverOne(id: string, encounterId: number | null) {
    const claim = randomUUID();
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 74007))`;
      if (encounterId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(74002, ${encounterId})`;
      const current = await tx.notificationOutbox.findUnique({ where: { id } });
      const now = new Date();
      if (!current || !['QUEUED', 'PROCESSING'].includes(current.status) || current.dueAt > now || (current.status === 'PROCESSING' && current.claimedAt && current.claimedAt.getTime() > now.getTime() - 120_000)) return null;
      const reason = await this.invalidReason(tx, current, now);
      if (reason) { await tx.notificationOutbox.update({ where: { id }, data: { status: 'CANCELLED', cancelledReason: reason, secretEncrypted: null, payloadEncrypted: null } }); return null; }
      if (current.firstAttemptAt && current.provider && current.provider !== (emailMode() === 'capture' ? 'capture' : 'resend')) {
        await tx.notificationOutbox.update({ where: { id }, data: { status: 'NEEDS_REVIEW', lastError: 'delivery_provider_changed' } }); return null;
      }
      if (current.firstAttemptAt && now.getTime() - current.firstAttemptAt.getTime() >= 23 * 3600_000) {
        await tx.notificationOutbox.update({ where: { id }, data: { status: 'NEEDS_REVIEW', lastError: 'idempotency_window_near_expiry', secretEncrypted: null, payloadEncrypted: null } }); return null;
      }
      const payload = current.payloadEncrypted ? JSON.parse(decrypt(current.payloadEncrypted)) as EmailPayload : current.payload ? current.payload as unknown as EmailPayload : await this.notifications.buildPayload(tx, current);
      const updated = await tx.notificationOutbox.update({ where: { id }, data: { status: 'PROCESSING', claimToken: claim, claimedAt: now, firstAttemptAt: current.firstAttemptAt || now, attemptCount: { increment: 1 }, provider: emailMode() === 'capture' ? 'capture' : 'resend',
        ...(current.purpose === 'recovery' ? { payloadEncrypted: encrypt(JSON.stringify(payload)), payload: Prisma.DbNull } : { payload: payload as unknown as Prisma.InputJsonValue }) } });
      return { ...updated, sendPayload: payload };
    });
    if (!row) return;
    try {
      // The database remains authoritative; do not hand stale queued work to the provider.
      const valid = await this.prisma.$transaction(async (tx) => {
        const current = await tx.notificationOutbox.findUnique({ where: { id } });
        return !!current && current.status === 'PROCESSING' && current.claimToken === claim && !await this.invalidReason(tx, current, new Date());
      });
      if (!valid) { await this.prisma.notificationOutbox.updateMany({ where: { id, claimToken: claim, status: 'PROCESSING' }, data: { status: 'CANCELLED', cancelledReason: 'changed_before_submission', secretEncrypted: null, payloadEncrypted: null } }); return; }
      const result = await this.provider.send(row.sendPayload, 'clinic-email/' + row.id);
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.notificationOutbox.findUniqueOrThrow({ where: { id } });
        await tx.notificationOutbox.update({ where: { id }, data: { status: current.status === 'DELIVERED' || (current.status === 'FAILED' && current.providerEmailId) ? current.status : 'ACCEPTED', providerEmailId: result.id, provider: result.provider, acceptedAt: new Date(), claimToken: null, claimedAt: null, lastError: current.status === 'FAILED' && current.providerEmailId ? current.lastError : null, secretEncrypted: null, payloadEncrypted: row.purpose === 'recovery' && result.provider !== 'capture' ? null : undefined } });
        await tx.notificationAttempt.create({ data: { notificationId: id, hospitalId: row.hospitalId, outcome: result.provider === 'capture' ? 'captured' : 'accepted' } });
      });
    } catch (cause) {
      const error = cause instanceof EmailSendError ? cause : new EmailSendError('delivery_outcome_unknown', true, true);
      const delay = row.purpose === 'recovery' ? [10_000, 30_000, 60_000, 120_000, 240_000][row.attemptCount - 1] : EMAIL_RETRY_DELAYS[row.attemptCount - 1];
      const retry = error.retryable && delay !== undefined && (!row.expiresAt || Date.now() + delay < row.expiresAt.getTime());
      await this.prisma.$transaction(async (tx) => {
        const status: NotificationStatus = retry ? 'QUEUED' : error.ambiguous ? 'NEEDS_REVIEW' : 'FAILED';
        await tx.notificationOutbox.updateMany({ where: { id, claimToken: claim, status: 'PROCESSING' }, data: { status, dueAt: retry ? new Date(Date.now() + delay) : row.dueAt, claimToken: null, claimedAt: null, lastError: error.code, ...(retry ? {} : { secretEncrypted: null, payloadEncrypted: row.purpose === 'recovery' ? null : undefined }) } });
        await tx.notificationAttempt.create({ data: { notificationId: id, hospitalId: row.hospitalId, outcome: error.ambiguous ? 'unknown' : 'failed', errorCode: error.code } });
      });
    }
    await this.notifications.notifyChanged(row.hospitalId, row.encounterId);
  }

  async webhook(rawBody: string, headers: { id: string; timestamp: string; signature: string }) {
    let event: ReturnType<NotificationProvider['verify']>;
    try { event = this.provider.verify(rawBody, headers); } catch { throw new BadRequestException('Invalid email webhook signature'); }
    const data = event.data as { email_id?: string; tags?: Record<string, string> };
    if (!data.email_id) return { accepted: true };
    const eventAt = new Date(event.created_at);
    if (Number.isNaN(eventAt.getTime())) throw new BadRequestException('Invalid event timestamp');
    const receipt = await this.prisma.notificationWebhookReceipt.createMany({ data: [{ id: headers.id, providerEmailId: data.email_id, eventType: event.type, eventAt }], skipDuplicates: true });
    if (receipt.count) await this.applyReceipt(data.email_id, event.type, eventAt, data.tags?.notification_id);
    return { accepted: true };
  }

  private async applyReceipt(providerEmailId: string, type: string, eventAt: Date, notificationId?: string) {
    const row = await this.prisma.notificationOutbox.findFirst({ where: notificationId ? { OR: [{ providerEmailId }, { id: notificationId, provider: 'resend' }] } : { providerEmailId } });
    if (!row) return;
    const failure = ['email.bounced', 'email.complained', 'email.failed', 'email.suppressed'].includes(type);
    if (['email.bounced', 'email.complained', 'email.suppressed'].includes(type)) {
      await this.prisma.notificationSuppression.upsert({ where: { hospitalId_email: { hospitalId: row.hospitalId, email: row.recipientEmail } }, create: { hospitalId: row.hospitalId, email: row.recipientEmail, reason: type }, update: { reason: type } });
    }
    if (!failure && type !== 'email.delivered') return;
    // A bounce or complaint remains a failure even if delayed delivered events arrive later.
    if (!failure && row.lastError && ['email.bounced', 'email.complained', 'email.suppressed'].includes(row.lastError)) return;
    await this.prisma.notificationOutbox.updateMany({ where: { id: row.id, OR: [{ lastEventAt: null }, { lastEventAt: { lte: eventAt } }] }, data: { providerEmailId, lastEventAt: eventAt, status: failure ? 'FAILED' : 'DELIVERED', deliveredAt: type === 'email.delivered' ? eventAt : undefined, lastError: failure ? type : null } });
    await this.notifications.notifyChanged(row.hospitalId, row.encounterId);
  }

  private async reconcileReceipts() {
    const rows = await this.prisma.notificationOutbox.findMany({ where: { providerEmailId: { not: null }, provider: 'resend', status: 'ACCEPTED', acceptedAt: { lt: new Date(Date.now() - 300_000) } }, select: { id: true, providerEmailId: true }, orderBy: { updatedAt: 'asc' }, take: 10 });
    for (const row of rows) {
      await this.prisma.notificationOutbox.updateMany({ where: { id: row.id, status: 'ACCEPTED' }, data: { updatedAt: new Date() } });
      const receipts = await this.prisma.notificationWebhookReceipt.findMany({ where: { providerEmailId: row.providerEmailId! }, orderBy: { eventAt: 'asc' } });
      for (const receipt of receipts) await this.applyReceipt(receipt.providerEmailId, receipt.eventType, receipt.eventAt);
      if (!receipts.length) {
        const result = await this.provider.retrieve(row.providerEmailId!).catch(() => null);
        if (result?.data?.last_event) await this.applyReceipt(row.providerEmailId!, 'email.' + result.data.last_event, new Date());
      }
    }
  }
}
