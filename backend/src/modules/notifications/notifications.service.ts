import { BadRequestException, ConflictException, ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { ClinicAppointment, EventType, NotificationStatus, Prisma, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicPilotService } from '../clinic/clinic-pilot.service';
import { EventsService } from '../events/events.service';
import { assertProviderConfiguration, decrypt, emailMode, renderEmail, TEMPLATE_VERSION, validateReminderMinutes, type EmailPayload, type EmailPurpose } from './notification-core';

type Staff = { hospitalId: number; userId: number; role: Role };
const ADMIN = new Set<Role>([Role.ADMIN, Role.IT_ADMIN, Role.CLINICAL_ADMIN]);
const RECEPTION = new Set<Role>([Role.STAFF, Role.ADMIN, Role.CLINICAL_ADMIN]);
export const UNSENT_STATUSES: NotificationStatus[] = [NotificationStatus.QUEUED, NotificationStatus.PROCESSING, NotificationStatus.FAILED];

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly pilot: ClinicPilotService, private readonly events: EventsService) {}
  onModuleInit() { assertProviderConfiguration(); }
  private staff(staff: Staff, admin = false) {
    this.pilot.assertTenantEnabled(staff.hospitalId);
    if (!(admin ? ADMIN : new Set([...RECEPTION, ...ADMIN])).has(staff.role)) throw new ForbiddenException();
  }
  async settings(staff: Staff) {
    this.staff(staff, true);
    const settings = await this.prisma.clinicNotificationSettings.findUnique({ where: { hospitalId: staff.hospitalId } });
    return { settings: settings || { enabled: false, replyTo: '', contactPhone: '', reminderMinutes: [1440, 120], version: 0 }, mode: emailMode(), templateVersion: TEMPLATE_VERSION };
  }
  async updateSettings(staff: Staff, input: { enabled: boolean; replyTo?: string; contactPhone?: string; reminderMinutes: number[]; expectedVersion: number }) {
    this.staff(staff, true);
    const reminderMinutes = validateReminderMinutes(input.reminderMinutes);
    if (input.enabled && (!input.replyTo || emailMode() === 'disabled')) throw new BadRequestException('Enable deployment delivery and supply the clinic Reply-To first');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74006, ${staff.hospitalId})`;
      const old = await tx.clinicNotificationSettings.findUnique({ where: { hospitalId: staff.hospitalId } });
      if ((old?.version ?? 0) !== input.expectedVersion) throw new ConflictException('Notification settings changed; reload them');
      const data = { enabled: input.enabled, replyTo: input.replyTo?.trim().toLowerCase() || null, contactPhone: input.contactPhone?.trim() || null, reminderMinutes, updatedByUserId: staff.userId };
      const settings = await tx.clinicNotificationSettings.upsert({ where: { hospitalId: staff.hospitalId }, create: { hospitalId: staff.hospitalId, ...data }, update: { ...data, version: { increment: 1 } } });
      await tx.notificationOutbox.updateMany({ where: { hospitalId: staff.hospitalId, status: { in: UNSENT_STATUSES }, providerEmailId: null, ...(input.enabled ? { purpose: 'reminder' } : {}) }, data: { status: 'CANCELLED', cancelledReason: 'notification_settings_changed', secretEncrypted: null, payloadEncrypted: null } });
      const appointments = await tx.clinicAppointment.findMany({ where: { hospitalId: staff.hospitalId, status: 'CONFIRMED', confirmedStartAt: { gt: new Date() }, encounter: { status: 'EXPECTED' } } });
      for (const appointment of appointments) await this.queueConfirmedTx(tx, appointment, false);
      return settings;
    });
  }

  async cancelPendingTx(tx: Prisma.TransactionClient, appointmentId: number, reason: string) {
    await tx.notificationOutbox.updateMany({ where: { appointmentId, purpose: { not: 'recovery' }, status: { in: UNSENT_STATUSES }, providerEmailId: null }, data: { status: 'CANCELLED', cancelledReason: reason, secretEncrypted: null } });
  }

  async appointmentChangedTx(tx: Prisma.TransactionClient, appointment: ClinicAppointment, kind: string, previouslyConfirmed: boolean) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74006, ${appointment.hospitalId})`;
    await this.cancelPendingTx(tx, appointment.id, 'appointment_' + kind);
    if (kind === 'confirm') await this.queueConfirmedTx(tx, appointment, true);
    else if (previouslyConfirmed && kind === 'reschedule') await this.queueTx(tx, appointment, 'change_pending', new Date(), 'change:' + appointment.revision);
    else if (previouslyConfirmed && ['cancel', 'decline', 'expire'].includes(kind)) await this.queueTx(tx, appointment, 'cancellation', new Date(), 'cancel:' + appointment.revision);
  }

  async contactChangedTx(tx: Prisma.TransactionClient, appointment: ClinicAppointment) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74006, ${appointment.hospitalId})`;
    const pendingChange = await tx.notificationOutbox.findFirst({ where: { appointmentId: appointment.id, purpose: 'change_pending', status: { in: UNSENT_STATUSES }, providerEmailId: null } });
    await this.cancelPendingTx(tx, appointment.id, 'contact_changed');
    await tx.appointmentRecoveryChallenge.updateMany({ where: { appointmentId: appointment.id, usedAt: null }, data: { revokedAt: new Date() } });
    await tx.appointmentRecoverySession.updateMany({ where: { appointmentId: appointment.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.notificationOutbox.updateMany({ where: { appointmentId: appointment.id, purpose: 'recovery', status: { in: UNSENT_STATUSES } }, data: { status: 'CANCELLED', secretEncrypted: null, payloadEncrypted: null, payload: Prisma.DbNull, cancelledReason: 'contact_changed' } });
    await tx.notificationOutbox.updateMany({ where: { appointmentId: appointment.id, purpose: 'recovery' }, data: { secretEncrypted: null, payloadEncrypted: null } });
    if (appointment.status === 'CONFIRMED') await this.queueConfirmedTx(tx, appointment, true);
    else if (appointment.status === 'REQUESTED' && pendingChange) await this.queueTx(tx, appointment, 'change_pending', new Date(), 'change:' + appointment.revision);
  }

  private async queueConfirmedTx(tx: Prisma.TransactionClient, appointment: ClinicAppointment, confirmation: boolean) {
    if (!appointment.confirmedStartAt) return;
    if (confirmation) await this.queueTx(tx, appointment, 'confirmation', new Date(), 'confirmation:' + appointment.revision);
    const settings = await tx.clinicNotificationSettings.findUnique({ where: { hospitalId: appointment.hospitalId } });
    for (const offset of validateReminderMinutes(settings?.reminderMinutes ?? [1440, 120])) {
      const dueAt = new Date(appointment.confirmedStartAt.getTime() - offset * 60_000);
      if (dueAt > new Date()) await this.queueTx(tx, appointment, 'reminder', dueAt, 'reminder:' + appointment.revision + ':' + offset + ':policy' + settings?.version);
    }
  }

  private async queueTx(tx: Prisma.TransactionClient, appointment: ClinicAppointment, purpose: EmailPurpose, dueAt: Date, suffix: string) {
    const settings = await tx.clinicNotificationSettings.findUnique({ where: { hospitalId: appointment.hospitalId } });
    if (!settings?.enabled || !settings.replyTo || emailMode() === 'disabled') return;
    const contact = await tx.encounterContact.findUnique({ where: { encounterId: appointment.encounterId } });
    if (!contact?.email) return;
    await tx.notificationOutbox.createMany({ data: [{ hospitalId: appointment.hospitalId, encounterId: appointment.encounterId, appointmentId: appointment.id,
      appointmentRevision: appointment.revision, contactVersion: contact.version, purpose, recipientEmail: contact.email, dueAt,
      dedupeKey: appointment.publicId + ':' + suffix + ':contact' + contact.version,
      expiresAt: purpose === 'reminder' ? new Date(Math.min(dueAt.getTime() + 30 * 60_000, appointment.requestedStartAt.getTime())) : new Date(Date.now() + 24 * 3600_000),
    }], skipDuplicates: true });
  }

  async buildPayload(tx: Prisma.TransactionClient, row: { id: string; hospitalId: number; appointmentId: number | null; purpose: string; recipientEmail: string; secretEncrypted: string | null }): Promise<EmailPayload> {
    const [settings, hospital, entry, appointment] = await Promise.all([
      tx.clinicNotificationSettings.findUnique({ where: { hospitalId: row.hospitalId } }), tx.hospital.findUniqueOrThrow({ where: { id: row.hospitalId } }),
      tx.clinicEntrySettings.findUniqueOrThrow({ where: { hospitalId: row.hospitalId } }), row.appointmentId ? tx.clinicAppointment.findUnique({ where: { id: row.appointmentId } }) : null,
    ]);
    const origin = (process.env.PATIENT_APP_URL || 'http://localhost:5176').replace(/\/$/, '');
    return renderEmail({ purpose: row.purpose as EmailPurpose, clinicName: hospital.name, recipient: row.recipientEmail, replyTo: settings?.replyTo || 'clinic@priage.local', contactPhone: settings?.contactPhone,
      startAt: appointment?.confirmedStartAt || appointment?.requestedStartAt, timezone: appointment?.timezone,
      manageUrl: origin + '/' + entry.canonicalAlias + '/appointment' + (appointment ? '#ref=' + encodeURIComponent(appointment.publicId) : ''),
      code: row.secretEncrypted ? decrypt(row.secretEncrypted) : undefined, notificationId: row.id });
  }

  async history(staff: Staff, appointmentId?: number, failures = false) {
    this.staff(staff);
    const capture = emailMode() === 'capture' && process.env.NODE_ENV !== 'production';
    const rows = await this.prisma.notificationOutbox.findMany({ where: { hospitalId: staff.hospitalId, ...(appointmentId ? { appointmentId } : {}), ...(staff.role === Role.IT_ADMIN ? { purpose: 'test' } : {}), ...(failures ? { status: { in: ['FAILED', 'NEEDS_REVIEW'] as NotificationStatus[] } } : {}) },
      select: { id: true, appointmentId: true, purpose: true, status: true, provider: true, providerEmailId: true, firstAttemptAt: true, expiresAt: true, recipientEmail: true, dueAt: true, attemptCount: true, lastError: true, cancelledReason: true, acceptedAt: true, deliveredAt: true, createdAt: true, attempts: { select: { outcome: true, errorCode: true, createdAt: true } }, payload: capture, payloadEncrypted: capture }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map(({ payloadEncrypted, providerEmailId, firstAttemptAt, expiresAt, ...row }) => ({ ...row, providerEmailId,
      retryAllowed: emailMode() !== 'disabled' && (!row.provider || row.provider === (emailMode() === 'capture' ? 'capture' : 'resend')) && row.status === 'FAILED' && !providerEmailId && (!firstAttemptAt || Date.now() - firstAttemptAt.getTime() < 23 * 3600_000) && (!expiresAt || expiresAt > new Date()),
      ...(capture && payloadEncrypted && expiresAt && expiresAt > new Date() ? { payload: JSON.parse(decrypt(payloadEncrypted)) as EmailPayload } : {}) }));
  }

  async retry(staff: Staff, id: string) {
    this.staff(staff);
    if (emailMode() === 'disabled') throw new ConflictException('Email delivery is disabled');
    const changed = await this.prisma.notificationOutbox.updateMany({ where: { id, hospitalId: staff.hospitalId, status: 'FAILED', providerEmailId: null, ...(staff.role === Role.IT_ADMIN ? { purpose: 'test' } : {}), OR: [{ firstAttemptAt: null }, { firstAttemptAt: { gt: new Date(Date.now() - 23 * 60 * 60_000) } }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, { OR: [{ provider: null }, { provider: emailMode() === 'capture' ? 'capture' : 'resend' }] }] }, data: { status: 'QUEUED', dueAt: new Date(), lastError: null, attemptCount: 0 } });
    if (!changed.count) throw new ConflictException('Only a known, current failure can be retried safely');
    return { queued: true };
  }
  async clearSuppression(staff: Staff, email: string) { this.staff(staff, true); if (staff.role === Role.IT_ADMIN) throw new ForbiddenException('Clinic supervisor review is required'); await this.prisma.notificationSuppression.deleteMany({ where: { hospitalId: staff.hospitalId, email: email.toLowerCase() } }); return { cleared: true }; }
  async suppressions(staff: Staff) { this.staff(staff, true); if (staff.role === Role.IT_ADMIN) return []; return this.prisma.notificationSuppression.findMany({ where: { hospitalId: staff.hospitalId }, select: { email: true, reason: true, createdAt: true } }); }
  async preview(staff: Staff) { this.staff(staff, true); return this.prisma.$transaction((tx) => this.buildPayload(tx, { id: 'preview', hospitalId: staff.hospitalId, appointmentId: null, purpose: 'test', recipientEmail: 'preview@example.com', secretEncrypted: null })); }
  async testSend(staff: Staff, recipient: string) {
    this.staff(staff, true);
    const settings = await this.settings(staff);
    if (!settings.settings.replyTo || emailMode() === 'disabled') throw new BadRequestException('Configure clinic Reply-To and deployment delivery first');
    return this.prisma.notificationOutbox.create({ data: { hospitalId: staff.hospitalId, purpose: 'test', recipientEmail: recipient.toLowerCase(), dedupeKey: 'test:' + randomUUID(), dueAt: new Date(), expiresAt: new Date(Date.now() + 3600_000) }, select: { id: true, status: true } });
  }
  async notifyChanged(hospitalId: number, encounterId: number | null) {
    if (!encounterId) return;
    const event = await this.prisma.$transaction((tx) => this.events.emitEncounterEventTx(tx, { hospitalId, encounterId, type: EventType.CARE_UPDATED, metadata: { workflow: 'CLINIC_APPOINTMENT', kind: 'notification_delivery' } }));
    void this.events.dispatchEncounterEventAndMarkProcessed(event);
  }
  async appointmentDeliverySummary(appointmentId: number, hospitalId: number) {
    return this.prisma.notificationOutbox.findMany({ where: { appointmentId, hospitalId, purpose: { not: 'recovery' } }, select: { purpose: true, status: true, provider: true, dueAt: true, acceptedAt: true, deliveredAt: true }, orderBy: { createdAt: 'desc' }, take: 6 });
  }
}
