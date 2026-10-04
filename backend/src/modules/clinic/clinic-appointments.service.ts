import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClinicAppointmentStatus, EncounterStatus, EventType, LegalDocumentKind, Prisma, Role, SensitiveReadResource } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { RecoveryContext } from '../notifications/appointment-recovery.service';

import { PatientContext } from '../auth/guards/patient.guard';
import { SensitiveReadAuditService } from '../audit/sensitive-read-audit.service';
import { EventsService } from '../events/events.service';
import { LegalDocumentsService } from '../legal/legal-documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicAssessmentService } from './clinic-assessment.service';
import { ClinicPilotService } from './clinic-pilot.service';
import { ClinicQuestionnaireService } from './questionnaire/clinic-questionnaire.service';
import { ClinicScheduleShape, clinicLocalParts, slotFitsWindow, validLocalDate, validateDailyWindows, validateSchedule, validateWeeklyWindows, type DailyWindow } from './clinic-schedule';
import { CreateClinicScheduleBlockDto, RequestClinicAppointmentDto, RescheduleClinicAppointmentDto, UpdateClinicScheduleDto, UpsertClinicDayOverrideDto } from './dto/clinic-appointment.dto';

type Staff = { userId: number; hospitalId: number; role: Role };
type Database = Prisma.TransactionClient | PrismaService;
type Schedule = ClinicScheduleShape & { hospitalId: number };
const MIN_LEAD_MS = 30 * 60_000;
const MAX_HORIZON_MS = 15 * 24 * 60 * 60_000;
const STEP_MS = 15 * 60_000;
const ACTIVE_APPOINTMENTS: ClinicAppointmentStatus[] = [ClinicAppointmentStatus.REQUESTED, ClinicAppointmentStatus.CONFIRMED];
const PRE_ARRIVAL: EncounterStatus[] = [EncounterStatus.REQUESTED, EncounterStatus.EXPECTED];
const SCHEDULE_ADMIN_ROLES: Role[] = [Role.ADMIN, Role.IT_ADMIN, Role.CLINICAL_ADMIN];
const RECEPTION_ROLES: Role[] = [Role.STAFF, Role.ADMIN, Role.CLINICAL_ADMIN];

@Injectable()
export class ClinicAppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pilot: ClinicPilotService,
    private readonly assessment: ClinicAssessmentService,
    private readonly legal: LegalDocumentsService,
    private readonly events: EventsService,
    private readonly audit: SensitiveReadAuditService,
    private readonly notifications: NotificationsService,
    private readonly questionnaire: ClinicQuestionnaireService,
  ) {}

  private hospitalId(selected?: number) { return selected ? this.pilot.assertTenantEnabled(selected) : this.pilot.assertPreviewEnabled(); }
  private assertStaff(staff: Staff) {
    return this.pilot.assertTenantEnabled(staff.hospitalId);
  }
  private assertAdmin(staff: Staff) {
    const hospitalId = this.assertStaff(staff);
    if (!SCHEDULE_ADMIN_ROLES.includes(staff.role)) throw new ForbiddenException('Clinic schedule administration requires an administrator');
    return hospitalId;
  }

  async publishedDocuments(selectedHospitalId?: number) {
    this.hospitalId(selectedHospitalId);
    const now = new Date();
    const [terms, privacy] = await Promise.all([LegalDocumentKind.TERMS, LegalDocumentKind.PRIVACY].map((kind) =>
      this.prisma.legalDocumentVersion.findFirst({ where: { kind, publishedAt: { lte: now } }, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        select: { id: true, kind: true, version: true, bodyMarkdown: true, publishedAt: true } })));
    return { terms, privacy, ready: !!terms && !!privacy };
  }

  async scheduleForStaff(staff: Staff) {
    const hospitalId = this.assertStaff(staff);
    const [schedule, overrides, blocks] = await Promise.all([
      this.prisma.clinicSchedule.findUnique({ where: { hospitalId } }),
      this.prisma.clinicScheduleOverride.findMany({ where: { hospitalId }, orderBy: { localDate: 'asc' } }),
      this.prisma.clinicScheduleBlock.findMany({ where: { hospitalId, endAt: { gt: new Date() } }, orderBy: { startAt: 'asc' }, take: 100 }),
    ]);
    return { schedule, overrides, blocks };
  }

  async updateSchedule(staff: Staff, dto: UpdateClinicScheduleDto) {
    const hospitalId = this.assertAdmin(staff);
    const value = validateSchedule(dto as ClinicScheduleShape);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74003, ${hospitalId})`;
      return tx.clinicSchedule.upsert({ where: { hospitalId }, create: { hospitalId, ...value }, update: value });
    });
  }

  async upsertDayOverride(staff: Staff, dto: UpsertClinicDayOverrideDto) {
    const hospitalId = this.assertAdmin(staff);
    const localDate = validLocalDate(dto.localDate);
    const windows = validateDailyWindows(dto.windows);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74003, ${hospitalId})`;
      return tx.clinicScheduleOverride.upsert({ where: { hospitalId_localDate: { hospitalId, localDate } },
        create: { hospitalId, localDate, windows }, update: { windows } });
    });
  }

  async removeDayOverride(staff: Staff, id: number) {
    const hospitalId = this.assertAdmin(staff);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74003, ${hospitalId})`;
      return tx.clinicScheduleOverride.deleteMany({ where: { id, hospitalId } });
    });
    if (!result.count) throw new NotFoundException();
    return { ok: true };
  }

  async createBlock(staff: Staff, dto: CreateClinicScheduleBlockDto) {
    const hospitalId = this.assertAdmin(staff);
    const startAt = this.parseInstant(dto.startAt);
    const endAt = this.parseInstant(dto.endAt);
    if (endAt <= startAt || endAt.getTime() - startAt.getTime() > 31 * 24 * 60 * 60_000) throw new BadRequestException('Invalid schedule block range');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74003, ${hospitalId})`;
      return tx.clinicScheduleBlock.create({ data: { hospitalId, startAt, endAt, reason: dto.reason.trim(), createdByUserId: staff.userId } });
    });
  }

  async removeBlock(staff: Staff, id: number) {
    const hospitalId = this.assertAdmin(staff);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74003, ${hospitalId})`;
      return tx.clinicScheduleBlock.deleteMany({ where: { id, hospitalId } });
    });
    if (!result.count) throw new NotFoundException();
    return { ok: true };
  }

  async availability(fromLocalDate?: string, days = 7, selectedHospitalId?: number) {
    const hospitalId = this.hospitalId(selectedHospitalId);
    if (!Number.isInteger(days) || days < 1 || days > 14) throw new BadRequestException('Availability days must be 1–14');
    const schedule = await this.loadSchedule(this.prisma, hospitalId);
    if (!schedule) return { configured: false, timezone: null, slots: [] };
    const today = clinicLocalParts(new Date(), schedule.timezone).localDate;
    const from = validLocalDate(fromLocalDate || today);
    if (from < today || from > new Date(Date.now() + MAX_HORIZON_MS).toISOString().slice(0, 10)) throw new BadRequestException('Availability date is outside the booking window');
    const endDate = new Date(Date.parse(`${from}T00:00:00Z`) + days * 24 * 60 * 60_000).toISOString().slice(0, 10);
    const scanStart = Date.parse(`${from}T00:00:00Z`) - 14 * 60 * 60_000;
    const scanEnd = Date.parse(`${endDate}T00:00:00Z`) + 14 * 60 * 60_000;
    const [overrides, blocks, appointments] = await Promise.all([
      this.prisma.clinicScheduleOverride.findMany({ where: { hospitalId, localDate: { gte: from, lt: endDate } } }),
      this.prisma.clinicScheduleBlock.findMany({ where: { hospitalId, startAt: { lt: new Date(scanEnd) }, endAt: { gt: new Date(scanStart) } } }),
      this.prisma.clinicAppointment.findMany({ where: { hospitalId, requestedStartAt: { lt: new Date(scanEnd) }, endAt: { gt: new Date(scanStart) },
        OR: [{ status: ClinicAppointmentStatus.CONFIRMED }, { status: ClinicAppointmentStatus.REQUESTED, expiresAt: { gt: new Date() } }] },
        select: { requestedStartAt: true, endAt: true } }),
    ]);
    const overrideMap = new Map(overrides.map((row) => [row.localDate, validateDailyWindows(row.windows)]));
    const slots: Array<{ startAt: string; endAt: string; localDate: string; remaining: number }> = [];
    for (let epoch = Math.ceil(scanStart / STEP_MS) * STEP_MS; epoch < scanEnd; epoch += STEP_MS) {
      if (epoch < Date.now() + MIN_LEAD_MS || epoch > Date.now() + MAX_HORIZON_MS) continue;
      const startAt = new Date(epoch);
      const local = clinicLocalParts(startAt, schedule.timezone);
      if (local.localDate < from || local.localDate >= endDate) continue;
      const windows = overrideMap.get(local.localDate) ?? schedule.weeklyWindows.filter((window) => window.day === local.day);
      if (!slotFitsWindow(startAt, schedule.slotMinutes, schedule.timezone, windows)) continue;
      const endAt = new Date(epoch + schedule.slotMinutes * 60_000);
      if (blocks.some((block) => block.startAt < endAt && block.endAt > startAt)) continue;
      const remaining = schedule.capacity - appointments.filter((appointment) => appointment.requestedStartAt < endAt && appointment.endAt > startAt).length;
      if (remaining > 0) slots.push({ startAt: startAt.toISOString(), endAt: endAt.toISOString(), localDate: local.localDate, remaining });
    }
    return { configured: true, timezone: schedule.timezone, slotMinutes: schedule.slotMinutes, slots };
  }

  private async loadSchedule(db: Database, hospitalId: number): Promise<Schedule | null> {
    const schedule = await db.clinicSchedule.findUnique({ where: { hospitalId } });
    if (!schedule) return null;
    return validateSchedule({ timezone: schedule.timezone, slotMinutes: schedule.slotMinutes as 15 | 30 | 60,
      capacity: schedule.capacity, holdMinutes: schedule.holdMinutes, weeklyWindows: validateWeeklyWindows(schedule.weeklyWindows) }) as Schedule;
  }

  private parseInstant(value: string): Date {
    if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value)) throw new BadRequestException('Appointment times must include a UTC offset');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid appointment time');
    return date;
  }

  private async assertSlotAvailableTx(tx: Prisma.TransactionClient, hospitalId: number, startAt: Date, excludeAppointmentId?: number) {
    // Serialize all capacity changes for a clinic, including overlapping slots
    // created under an older slot duration and concurrent schedule edits.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74003, ${hospitalId})`;
    const schedule = await this.loadSchedule(tx, hospitalId);
    if (!schedule) throw new ConflictException('Clinic availability has not been configured');
    if (startAt.getTime() < Date.now() + MIN_LEAD_MS || startAt.getTime() > Date.now() + MAX_HORIZON_MS || startAt.getTime() % STEP_MS !== 0) {
      throw new ConflictException('This appointment time is no longer available');
    }
    const local = clinicLocalParts(startAt, schedule.timezone);
    const override = await tx.clinicScheduleOverride.findUnique({ where: { hospitalId_localDate: { hospitalId, localDate: local.localDate } } });
    const windows: DailyWindow[] = override ? validateDailyWindows(override.windows) : schedule.weeklyWindows.filter((window) => window.day === local.day);
    if (!slotFitsWindow(startAt, schedule.slotMinutes, schedule.timezone, windows)) throw new ConflictException('This appointment time is outside clinic hours');
    const endAt = new Date(startAt.getTime() + schedule.slotMinutes * 60_000);
    const blocked = await tx.clinicScheduleBlock.count({ where: { hospitalId, startAt: { lt: endAt }, endAt: { gt: startAt } } });
    if (blocked) throw new ConflictException('This appointment time is blocked');
    const occupied = await tx.clinicAppointment.count({ where: { hospitalId, requestedStartAt: { lt: endAt }, endAt: { gt: startAt },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      OR: [{ status: ClinicAppointmentStatus.CONFIRMED }, { status: ClinicAppointmentStatus.REQUESTED, expiresAt: { gt: new Date() } }] } });
    if (occupied >= schedule.capacity) throw new ConflictException('This appointment time just filled; refresh availability');
    return { schedule, endAt };
  }

  async requestAppointment(encounterId: number, patient: PatientContext, dto: RequestClinicAppointmentDto) {
    const startAt = this.parseInstant(dto.startAt);
    const encounter = await this.prisma.encounter.findFirst({ where: { id: encounterId, patientId: patient.patientId },
      include: { intakeSessions: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } }, contact: true, clinicAppointment: true, visitAcceptance: true } });
    if (!encounter) throw new NotFoundException();
    const hospitalId = this.pilot.assertTenantEnabled(encounter.hospitalId);
    if (encounter.clinicAppointment) return this.retryRequest(encounter.clinicAppointment, dto, startAt, encounter.visitAcceptance);
    if (encounter.status !== EncounterStatus.INTAKE || !encounter.contact?.email) throw new ConflictException('A pre-visit with contact email is required');
    const intakeId = encounter.intakeSessions[0]?.id;
    if (!intakeId || await this.assessment.status(intakeId) !== 'complete') throw new ConflictException('Complete the assessment before requesting an appointment');
    if ((await this.questionnaire.statusForIntake(hospitalId, intakeId)).status === 'pending') throw new ConflictException('Answer the clinic’s questions before choosing a time');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(74002, ${encounterId})`;
        const fresh = await tx.encounter.findUniqueOrThrow({ where: { id_hospitalId: { id: encounterId, hospitalId } },
          include: { clinicAppointment: true, contact: true, visitAcceptance: true } });
        if (fresh.clinicAppointment) return { appointment: this.retryRequest(fresh.clinicAppointment, dto, startAt, fresh.visitAcceptance), event: null };
        if (fresh.status !== EncounterStatus.INTAKE || !fresh.contact?.email) throw new ConflictException('Visit state changed; refresh before requesting');
        const { schedule, endAt } = await this.assertSlotAvailableTx(tx, hospitalId, startAt);
        await this.legal.recordAcceptanceTx(tx, { intakeSessionId: intakeId, patientId: patient.patientId, encounterId,
          termsDocumentId: dto.termsDocumentId, privacyDocumentId: dto.privacyDocumentId, accepted: dto.accepted });
        const appointment = await tx.clinicAppointment.create({ data: {
          publicId: `appt_${randomUUID()}`, hospitalId, encounterId, requestKey: dto.requestKey,
          requestedStartAt: startAt, endAt, timezone: schedule.timezone, slotMinutes: schedule.slotMinutes,
          expiresAt: new Date(Date.now() + schedule.holdMinutes * 60_000),
        } });
        const changed = await tx.encounter.updateMany({ where: { id: encounterId, hospitalId, status: EncounterStatus.INTAKE }, data: { status: EncounterStatus.REQUESTED } });
        if (changed.count !== 1) throw new ConflictException('Visit state changed; refresh before requesting');
        const event = await this.events.emitEncounterEventTx(tx, { encounterId, hospitalId, type: EventType.STATUS_CHANGE,
          metadata: { workflow: 'CLINIC_APPOINTMENT', appointmentId: appointment.id, fromStatus: 'INTAKE', toStatus: 'REQUESTED', requestedStartAt: startAt.toISOString() },
          actor: { actorPatientId: patient.patientId } });
        return { appointment: this.toAppointment(appointment), event };
      });
      if (result.event) void this.events.dispatchEncounterEventAndMarkProcessed(result.event);
      return result.appointment;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Appointment request was already submitted; refresh the visit');
      }
      throw error;
    }
  }

  private retryRequest(appointment: { id: number; requestKey: string; requestedStartAt: Date; status: ClinicAppointmentStatus; timezone: string; slotMinutes: number; endAt: Date; expiresAt: Date | null; confirmedStartAt: Date | null; revision: number }, dto: RequestClinicAppointmentDto, startAt: Date,
    acceptance: { termsDocumentId: number; privacyDocumentId: number } | null) {
    if (appointment.requestKey !== dto.requestKey || appointment.requestedStartAt.getTime() !== startAt.getTime()
      || dto.accepted !== true || !acceptance || acceptance.termsDocumentId !== dto.termsDocumentId
      || acceptance.privacyDocumentId !== dto.privacyDocumentId) {
      throw new ConflictException('This visit already has an appointment request');
    }
    return this.toAppointment(appointment);
  }

  async patientAppointment(encounterId: number, patient: PatientContext) {
    const owned = await this.prisma.encounter.findFirst({ where: { id: encounterId, patientId: patient.patientId }, select: { hospitalId: true } });
    if (!owned) throw new NotFoundException();
    const hospitalId = this.pilot.assertTenantEnabled(owned.hospitalId);
    await this.expireDue(hospitalId);
    const encounter = await this.prisma.encounter.findFirst({ where: { id: encounterId, hospitalId, patientId: patient.patientId },
      include: { clinicAppointment: true } });
    if (!encounter) throw new NotFoundException();
    return encounter.clinicAppointment ? this.toAppointment(encounter.clinicAppointment) : null;
  }

  async patientVisitState(encounterId: number, patient: PatientContext) {
    const encounter = await this.prisma.encounter.findFirst({ where: { id: encounterId, patientId: patient.patientId },
      include: { clinicAppointment: true, contact: true, intakeSessions: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } } });
    if (!encounter) throw new NotFoundException();
    const hospitalId = this.pilot.assertTenantEnabled(encounter.hospitalId);
    await this.expireDue(hospitalId);
    const fresh = await this.prisma.encounter.findUniqueOrThrow({ where: { id: encounterId }, include: { clinicAppointment: true } });
    const appointment = fresh.clinicAppointment;
    const now = new Date();
    const [schedule, terms, privacy, interviewStatus, entry, clinicQuestions] = await Promise.all([
      this.prisma.clinicSchedule.findUnique({ where: { hospitalId }, select: { hospitalId: true } }),
      this.prisma.legalDocumentVersion.findFirst({ where: { kind: 'TERMS', publishedAt: { lte: now } }, select: { id: true } }),
      this.prisma.legalDocumentVersion.findFirst({ where: { kind: 'PRIVACY', publishedAt: { lte: now } }, select: { id: true } }),
      encounter.intakeSessions[0] ? this.assessment.status(encounter.intakeSessions[0].id) : Promise.resolve(null),
      this.prisma.clinicEntrySettings.findUnique({ where: { hospitalId }, select: { canonicalAlias: true } }),
      encounter.intakeSessions[0] ? this.questionnaire.statusForIntake(hospitalId, encounter.intakeSessions[0].id).then((result) => result.status) : Promise.resolve('none' as const),
    ]);
    const allowedActions = appointment && ACTIVE_APPOINTMENTS.includes(appointment.status) && PRE_ARRIVAL.includes(fresh.status)
      ? [
          ...(appointment.requestedStartAt > now ? ['reschedule', 'cancel'] : []),
        ] : !appointment && fresh.status === EncounterStatus.INTAKE && interviewStatus === 'complete' && clinicQuestions !== 'pending' && !!encounter.contact?.email && !!schedule && !!terms && !!privacy
        ? ['request'] : [];
    return { encounter: { id: fresh.id, status: fresh.status, hospitalId, chiefComplaint: fresh.chiefComplaint, updatedAt: fresh.updatedAt },
      canonicalAlias: entry?.canonicalAlias ?? null,
      contactEmail: encounter.contact?.email ?? null, contactVerified: !!encounter.contact?.verifiedAt, interviewStatus,
      /** 'pending' after the assessment means the clinic's own questions still need answering before booking. */
      clinicQuestions,
      appointment: appointment ? this.toAppointment(appointment) : null,
      bookingReadiness: { ready: !!schedule && !!terms && !!privacy, scheduleConfigured: !!schedule, legalPublished: !!terms && !!privacy },
      allowedActions, revision: appointment?.revision ?? 0,
      notifications: appointment ? await this.notifications.appointmentDeliverySummary(appointment.id, hospitalId) : [] };
  }

  async receptionAppointments(staff: Staff) {
    const hospitalId = this.assertStaff(staff);
    await this.expireDue(hospitalId);
    const rows = await this.prisma.clinicAppointment.findMany({ where: { hospitalId, status: { in: ACTIVE_APPOINTMENTS } },
      include: { encounter: { include: { patient: { select: { firstName: true, lastName: true, phone: true, age: true, gender: true } }, contact: true } } },
      orderBy: [{ requestedStartAt: 'asc' }, { id: 'asc' }], take: 300 });
    await this.audit.record({ resource: SensitiveReadResource.ENCOUNTER_LIST, actorUserId: staff.userId, hospitalId,
      metadata: { workflow: 'CLINIC_APPOINTMENT', view: 'appointment_queue', count: rows.length } });
    const mapped = rows.map((row) => {
      const name = [row.encounter.patient.firstName, row.encounter.patient.lastName].filter(Boolean).join(' ') || 'Patient';
      const safe = (value: string | null | undefined) => (value || '').replace(/[\r\n\t]+/g, ' ').trim();
      const slot = row.status === ClinicAppointmentStatus.CONFIRMED && row.confirmedStartAt ? row.confirmedStartAt : row.requestedStartAt;
      const localSlot = new Intl.DateTimeFormat('en-CA', { timeZone: row.timezone, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(slot);
      return { ...this.toAppointment(row), encounterId: row.encounterId, encounterStatus: row.encounter.status,
        allowedActions: row.status === ClinicAppointmentStatus.REQUESTED && row.encounter.status === EncounterStatus.REQUESTED
          ? ['confirm', 'decline', 'reschedule']
          : row.status === ClinicAppointmentStatus.CONFIRMED && row.encounter.status === EncounterStatus.EXPECTED
            ? ['arrive', 'reschedule', ...(row.requestedStartAt > new Date() ? ['cancel'] : []), ...(row.endAt <= new Date() ? ['no-show'] : [])] : [],
        patientName: name, patientId: row.encounter.patientId, age: row.encounter.patient.age ?? null,
        gender: row.encounter.patient.gender ?? null, chiefComplaint: row.encounter.chiefComplaint,
        createdAt: row.encounter.createdAt, contactEmail: row.encounter.contact?.email ?? null,
        contactPhone: row.encounter.contact?.phone ?? row.encounter.patient.phone ?? null,
        copyText: `Patient: ${safe(name)}\nEmail: ${safe(row.encounter.contact?.email)}\nPhone: ${safe(row.encounter.contact?.phone ?? row.encounter.patient.phone)}\nAppointment: ${localSlot} (${row.timezone})\nStatus: ${row.status === ClinicAppointmentStatus.CONFIRMED ? 'Confirmed' : 'Requested — pending clinic confirmation'}` };
    });
    return {
      newAppointments: mapped.filter((row) => row.status === ClinicAppointmentStatus.REQUESTED && row.encounterStatus === EncounterStatus.REQUESTED),
      expected: mapped.filter((row) => row.status === ClinicAppointmentStatus.CONFIRMED && row.encounterStatus === EncounterStatus.EXPECTED),
      arrived: mapped.filter((row) => row.status === ClinicAppointmentStatus.CONFIRMED && row.encounterStatus === EncounterStatus.ADMITTED),
    };
  }

  private toAppointment(appointment: { id: number; status: ClinicAppointmentStatus; requestedStartAt: Date; confirmedStartAt: Date | null; endAt: Date; timezone: string; slotMinutes: number; expiresAt: Date | null; revision: number }) {
    return { id: appointment.id, status: appointment.status, requestedStartAt: appointment.requestedStartAt,
      confirmedStartAt: appointment.confirmedStartAt, endAt: appointment.endAt, timezone: appointment.timezone,
      slotMinutes: appointment.slotMinutes, expiresAt: appointment.expiresAt, revision: appointment.revision };
  }

  private async expireDue(hospitalId: number) {
    const due = await this.prisma.clinicAppointment.findMany({ where: { hospitalId, status: ClinicAppointmentStatus.REQUESTED, expiresAt: { lte: new Date() } },
      select: { id: true, encounterId: true }, take: 100 });
    for (const item of due) {
      const event = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(74002, ${item.encounterId})`;
        const current = await tx.clinicAppointment.findUnique({ where: { id: item.id } });
        if (!current || current.status !== ClinicAppointmentStatus.REQUESTED || !current.expiresAt || current.expiresAt > new Date()) return null;
        const updated = await tx.clinicAppointment.update({ where: { id: item.id }, data: { status: ClinicAppointmentStatus.EXPIRED, resolvedAt: new Date(), expiresAt: null, revision: { increment: 1 } } });
        const hadConfirmation = !!await tx.clinicAppointmentAction.findFirst({ where: { appointmentId: item.id, kind: 'confirm' } });
        await this.notifications.appointmentChangedTx(tx, updated, 'expire', hadConfirmation);
        const changed = await tx.encounter.updateMany({ where: { id: item.encounterId, hospitalId, status: EncounterStatus.REQUESTED }, data: { status: EncounterStatus.CANCELLED, cancelledAt: new Date() } });
        if (changed.count !== 1) return null;
        return this.events.emitEncounterEventTx(tx, { encounterId: item.encounterId, hospitalId, type: EventType.STATUS_CHANGE,
          metadata: { workflow: 'CLINIC_APPOINTMENT', appointmentId: item.id, fromStatus: 'REQUESTED', toStatus: 'CANCELLED', appointmentStatus: 'EXPIRED' } });
      });
      if (event) void this.events.dispatchEncounterEventAndMarkProcessed(event);
    }
  }

  async sweepExpiredRequests() {
    const tenants = await this.prisma.clinicAppointment.findMany({
      where: { status: ClinicAppointmentStatus.REQUESTED, expiresAt: { lte: new Date() } },
      select: { hospitalId: true }, distinct: ['hospitalId'], take: 100,
    });
    for (const tenant of tenants) await this.expireDue(tenant.hospitalId);
  }

  async staffCommand(staff: Staff, appointmentId: number, commandKey: string,
    kind: 'confirm' | 'decline' | 'reschedule' | 'arrive' | 'no_show' | 'cancel', newStartAt?: string, expectedRevision?: number) {
    const hospitalId = this.assertStaff(staff);
    if (!RECEPTION_ROLES.includes(staff.role)) throw new ForbiddenException('Reception appointment action requires Reception or supervisor access');
    return this.command(hospitalId, appointmentId, commandKey, kind, { userId: staff.userId }, newStartAt, expectedRevision);
  }

  async patientCommand(patient: PatientContext, encounterId: number, commandKey: string,
    kind: 'reschedule' | 'cancel', newStartAt?: string, expectedRevision?: number) {
    const appointment = await this.prisma.clinicAppointment.findFirst({ where: { encounterId, encounter: { patientId: patient.patientId } }, select: { id: true, hospitalId: true } });
    if (!appointment) throw new NotFoundException();
    const hospitalId = this.pilot.assertTenantEnabled(appointment.hospitalId);
    return this.command(hospitalId, appointment.id, commandKey, kind, { patientId: patient.patientId }, newStartAt, expectedRevision);
  }

  async recoveryState(context: RecoveryContext) {
    this.pilot.assertTenantEnabled(context.hospitalId);
    await this.expireDue(context.hospitalId);
    const appointment = await this.prisma.clinicAppointment.findFirst({ where: { id: context.appointmentId, hospitalId: context.hospitalId, encounterId: context.encounterId }, include: { encounter: { select: { status: true, updatedAt: true } } } });
    if (!appointment) throw new NotFoundException();
    const [hospital, entry, settings] = await Promise.all([
      this.prisma.hospital.findUniqueOrThrow({ where: { id: context.hospitalId }, select: { name: true } }),
      this.prisma.clinicEntrySettings.findUniqueOrThrow({ where: { hospitalId: context.hospitalId }, select: { canonicalAlias: true } }),
      this.prisma.clinicNotificationSettings.findUnique({ where: { hospitalId: context.hospitalId }, select: { replyTo: true, contactPhone: true } }),
    ]);
    return { reference: appointment.publicId, clinic: { name: hospital.name, alias: entry.canonicalAlias, ...settings }, encounter: { id: appointment.encounterId, status: appointment.encounter.status, updatedAt: appointment.encounter.updatedAt }, appointment: this.toAppointment(appointment),
      allowedActions: ACTIVE_APPOINTMENTS.includes(appointment.status) && PRE_ARRIVAL.includes(appointment.encounter.status) && appointment.requestedStartAt > new Date() ? ['reschedule', 'cancel'] : [],
      verificationFresh: Date.now() - context.verifiedAt.getTime() < 600_000, revision: appointment.revision };
  }

  async recoveryCommand(context: RecoveryContext, commandKey: string, kind: 'reschedule' | 'cancel', newStartAt: string | undefined, expectedRevision: number) {
    this.pilot.assertTenantEnabled(context.hospitalId);
    await this.command(context.hospitalId, context.appointmentId, commandKey, kind, { recoverySessionId: context.sessionId }, newStartAt, expectedRevision);
    return this.recoveryState(context);
  }

  private async command(hospitalId: number, appointmentId: number, commandKey: string,
    kind: 'confirm' | 'decline' | 'reschedule' | 'arrive' | 'no_show' | 'cancel',
    actor: { userId?: number; patientId?: number; recoverySessionId?: string }, newStartAt?: string, expectedRevision?: number) {
    const targetStartAt = kind === 'reschedule' ? this.parseInstant(newStartAt || '') : null;
    const current = await this.prisma.clinicAppointment.findFirst({ where: { id: appointmentId, hospitalId }, select: { encounterId: true } });
    if (!current) throw new NotFoundException();
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(74002, ${current.encounterId})`;
        if (actor.recoverySessionId) {
          const session = await tx.appointmentRecoverySession.findUnique({ where: { id: actor.recoverySessionId } });
          const contact = await tx.encounterContact.findUnique({ where: { encounterId: current.encounterId } });
          if (!session || session.appointmentId !== appointmentId || session.hospitalId !== hospitalId || session.revokedAt || session.expiresAt <= new Date() || session.contactVersion !== contact?.version || Date.now() - session.verifiedAt.getTime() >= 600_000) throw new ForbiddenException('Verify your email again before changing this appointment');
        }
        const prior = await tx.clinicAppointmentAction.findUnique({ where: { commandKey } });
        if (prior) {
          if (prior.appointmentId !== appointmentId || prior.kind !== kind
            || (targetStartAt && prior.requestedStartAt?.getTime() !== targetStartAt.getTime())) throw new ConflictException('Command key was used for a different appointment action');
          const appointment = await tx.clinicAppointment.findUniqueOrThrow({ where: { id: appointmentId } });
          return { appointment, event: null };
        }
        const appointment = await tx.clinicAppointment.findFirst({ where: { id: appointmentId, hospitalId },
          include: { encounter: { select: { status: true, patientId: true } } } });
        if (!appointment) throw new NotFoundException();
        if (actor.patientId && appointment.encounter.patientId !== actor.patientId) throw new NotFoundException();
        if (expectedRevision !== undefined && appointment.revision !== expectedRevision) throw new ConflictException('Appointment changed; reload current visit state');
        const fromStatus = appointment.encounter.status;
        const now = new Date();
        if (appointment.status === ClinicAppointmentStatus.REQUESTED && appointment.expiresAt && appointment.expiresAt <= now) {
          throw new ConflictException('Appointment request expired; refresh the visit');
        }
        let toStatus: EncounterStatus;
        let appointmentData: Prisma.ClinicAppointmentUncheckedUpdateInput;
        let encounterData: Prisma.EncounterUpdateManyMutationInput;
        if (kind === 'confirm') {
          if (appointment.status !== ClinicAppointmentStatus.REQUESTED || fromStatus !== EncounterStatus.REQUESTED || !appointment.expiresAt || appointment.expiresAt <= now) throw new ConflictException('Only a current appointment request can be confirmed');
          toStatus = EncounterStatus.EXPECTED;
          appointmentData = { status: ClinicAppointmentStatus.CONFIRMED, confirmedStartAt: appointment.requestedStartAt,
            confirmedAt: now, confirmedByUserId: actor.userId, expiresAt: null, revision: { increment: 1 } };
          encounterData = { status: toStatus, expectedAt: appointment.requestedStartAt };
        } else if (kind === 'reschedule') {
          if (!targetStartAt || targetStartAt.getTime() === appointment.requestedStartAt.getTime() || !ACTIVE_APPOINTMENTS.includes(appointment.status) || !PRE_ARRIVAL.includes(fromStatus)) throw new ConflictException('Choose a different available time to reschedule');
          const { schedule, endAt } = await this.assertSlotAvailableTx(tx, hospitalId, targetStartAt, appointment.id);
          toStatus = EncounterStatus.REQUESTED;
          appointmentData = { status: ClinicAppointmentStatus.REQUESTED, requestedStartAt: targetStartAt, confirmedStartAt: null,
            confirmedAt: null, confirmedByUserId: null, timezone: schedule.timezone, slotMinutes: schedule.slotMinutes,
            endAt, expiresAt: new Date(now.getTime() + schedule.holdMinutes * 60_000), revision: { increment: 1 } };
          encounterData = { status: toStatus, expectedAt: null };
        } else if (kind === 'decline') {
          if (appointment.status !== ClinicAppointmentStatus.REQUESTED || fromStatus !== EncounterStatus.REQUESTED) throw new ConflictException('Only a pending request can be declined');
          toStatus = EncounterStatus.CANCELLED;
          appointmentData = { status: ClinicAppointmentStatus.DECLINED, expiresAt: null, resolvedAt: now, resolvedByUserId: actor.userId, revision: { increment: 1 } };
          encounterData = { status: toStatus, cancelledAt: now };
        } else if (kind === 'cancel') {
          if (!ACTIVE_APPOINTMENTS.includes(appointment.status) || !PRE_ARRIVAL.includes(fromStatus) || appointment.requestedStartAt <= now) throw new ConflictException('This appointment can no longer be cancelled online');
          toStatus = EncounterStatus.CANCELLED;
          appointmentData = { status: ClinicAppointmentStatus.CANCELLED, expiresAt: null, resolvedAt: now, resolvedByUserId: actor.userId ?? null, revision: { increment: 1 } };
          encounterData = { status: toStatus, cancelledAt: now };
        } else if (kind === 'arrive') {
          if (appointment.status !== ClinicAppointmentStatus.CONFIRMED || fromStatus !== EncounterStatus.EXPECTED) throw new ConflictException('Only a confirmed expected patient can be marked arrived');
          toStatus = EncounterStatus.ADMITTED;
          appointmentData = { revision: { increment: 1 } };
          encounterData = { status: toStatus, arrivedAt: now };
        } else {
          if (appointment.status !== ClinicAppointmentStatus.CONFIRMED || fromStatus !== EncounterStatus.EXPECTED || appointment.endAt > now) throw new ConflictException('No-show can be recorded only after a confirmed slot ends');
          toStatus = EncounterStatus.UNRESOLVED;
          appointmentData = { status: ClinicAppointmentStatus.NO_SHOW, resolvedAt: now, resolvedByUserId: actor.userId, revision: { increment: 1 } };
          encounterData = { status: toStatus, departedAt: now };
        }
        const updated = await tx.clinicAppointment.update({ where: { id: appointmentId }, data: appointmentData });
        const previouslyConfirmed = appointment.status === 'CONFIRMED' || !!await tx.clinicAppointmentAction.findFirst({ where: { appointmentId, kind: 'confirm' } });
        await this.notifications.appointmentChangedTx(tx, updated, kind, previouslyConfirmed);
        const changed = await tx.encounter.updateMany({ where: { id: appointment.encounterId, hospitalId, status: fromStatus }, data: encounterData });
        if (changed.count !== 1) throw new ConflictException('Visit changed during appointment action');
        await tx.clinicAppointmentAction.create({ data: { appointmentId, hospitalId, commandKey, kind,
          requestedStartAt: targetStartAt, actorPatientId: actor.patientId ?? null, actorUserId: actor.userId ?? null, revision: updated.revision } });
        const event = await this.events.emitEncounterEventTx(tx, { encounterId: appointment.encounterId, hospitalId, type: EventType.STATUS_CHANGE,
          metadata: { workflow: 'CLINIC_APPOINTMENT', appointmentId, appointmentStatus: updated.status, appointmentRevision: updated.revision,
            action: kind, ...(actor.recoverySessionId ? { entryMode: 'verified_appointment_recovery', recoverySessionId: actor.recoverySessionId } : {}), fromStatus, toStatus, requestedStartAt: updated.requestedStartAt.toISOString() },
          actor: actor.userId ? { actorUserId: actor.userId } : { actorPatientId: actor.patientId } });
        return { appointment: updated, event };
      });
      if (result.event) void this.events.dispatchEncounterEventAndMarkProcessed(result.event);
      return this.toAppointment(result.appointment);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Appointment action was already submitted; refresh the visit');
      throw error;
    }
  }
}
