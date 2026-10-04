import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClinicAppointmentStatus, EncounterStatus, EventType, Prisma, Role, SensitiveReadResource, SummaryProjectionKind } from '@prisma/client';

import { SensitiveReadAuditService } from '../audit/sensitive-read-audit.service';
import { ClinicalAccessService } from '../clinical-access/clinical-access.service';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicPilotService } from './clinic-pilot.service';
import { CLINIC_RESPONSE_ITEM } from './questionnaire/clinic-questionnaire';
import { ClinicQuestionnaireService } from './questionnaire/clinic-questionnaire.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildCareSnapshotContentV2, isSnapshotV2, queueHandoffSummary, type CareSnapshotContent } from './care/care-snapshot';
import { CLINIC_HANDOFF_RULES_VERSION } from './care/clinic-handoff.rules';
import { CareFeedbackError, feedbackTarget } from './care/care-feedback';
import { emergencyMarker } from './care/emergency-events';
import { CareCopyAuditDto, CareFeedbackDto, ClearCareFeedbackDto, CreateCareCommentDto, CreateCareQuestionDto, FinishCareDto, SaveCareNoteDto, StartCareDto, UpdateCareCommentDto, UpdateCareQuestionDto } from './dto/clinic-care.dto';

type Staff = { userId: number; hospitalId: number; role: Role };
type JsonRecord = Record<string, unknown>;

export type { CareSegment, CareSnapshotContent, CareSnapshotContentV1, CareSnapshotContentV2 } from './care/care-snapshot';

const asRecord = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const stringValue = (value: unknown): string => typeof value === 'string' ? value : '';
const CARE_WRITE_ROLES = new Set<Role>([Role.DOCTOR, Role.CLINICAL_ADMIN]);
const CARE_READ_ROLES = new Set<Role>([Role.DOCTOR, Role.CLINICAL_ADMIN, Role.NURSE, Role.ADMIN]);
const CARE_EDIT_STATUSES = new Set<EncounterStatus>([EncounterStatus.CARE, EncounterStatus.COMPLETE]);

@Injectable()
export class ClinicCareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pilot: ClinicPilotService,
    private readonly access: ClinicalAccessService,
    private readonly audit: SensitiveReadAuditService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
    private readonly questionnaire: ClinicQuestionnaireService,
  ) {}

  private async encounter(staff: Staff, encounterId: number, write = false) {
    this.pilot.assertTenantEnabled(staff.hospitalId);
    if (write && !CARE_WRITE_ROLES.has(staff.role)) throw new ForbiddenException('Physician Care editing requires a doctor or clinical admin');
    if (!CARE_READ_ROLES.has(staff.role)) throw new ForbiddenException('Clinical access required');
    const encounter = await this.prisma.encounter.findFirst({ where: { id: encounterId, hospitalId: staff.hospitalId }, select: { id: true, status: true } });
    if (!encounter) throw new NotFoundException('Clinic visit not found');
    await this.access.assertClinicalEncounterAccess(staff, encounterId);
    if (staff.role === Role.NURSE && !CARE_EDIT_STATUSES.has(encounter.status)) {
      throw new ForbiddenException('Care is available to nurses after physician handoff');
    }
    return encounter;
  }

  async queue(staff: Staff) {
    this.pilot.assertTenantEnabled(staff.hospitalId);
    if (!CARE_READ_ROLES.has(staff.role)) throw new ForbiddenException('Clinical access required');
    const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const encounters = await this.prisma.encounter.findMany({
      where: { hospitalId: staff.hospitalId, OR: [{ status: { in: [EncounterStatus.ADMITTED, EncounterStatus.CARE] } }, { status: EncounterStatus.COMPLETE, departedAt: { gte: since } }] },
      include: { patient: { select: { firstName: true, lastName: true, age: true, gender: true, allergies: true, conditions: true } }, intakeSessions: { select: { id: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 250,
    });
    const accessible = await this.access.getClinicallyAccessibleEncounterIds(staff, encounters.map((row) => row.id));
    const scoped = encounters.filter((row) => accessible.has(row.id) && (staff.role !== Role.NURSE || row.status !== EncounterStatus.ADMITTED));
    const intakeIds = scoped.map((row) => row.intakeSessions[0]?.id).filter((id): id is number => typeof id === 'number');
    const [states, intakeItems] = intakeIds.length ? await Promise.all([
      this.prisma.contextItem.findMany({
        where: { intakeSessionId: { in: intakeIds }, itemType: 'ai_interview_state', supersededBy: { none: {} } },
        select: { intakeSessionId: true, payload: true },
      }),
      this.prisma.contextItem.findMany({
        where: { intakeSessionId: { in: intakeIds }, itemType: 'patient_intake' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { intakeSessionId: true, payload: true },
      }),
    ]) : [[], []];
    const stateByIntake = new Map(states.map((state) => [state.intakeSessionId, state.payload]));
    const clinicQuestionsByIntake = await this.questionnaire.statusForIntakes(staff.hospitalId, stateByIntake, intakeIds);
    const intakeByIntake = new Map<number, { chiefComplaint: string | null; details: string | null }>();
    for (const item of intakeItems) {
      if (item.intakeSessionId == null || intakeByIntake.has(item.intakeSessionId)) continue;
      const payload = asRecord(item.payload);
      intakeByIntake.set(item.intakeSessionId, { chiefComplaint: stringValue(payload.chiefComplaint) || null, details: stringValue(payload.details) || null });
    }
    await this.audit.record({ resource: SensitiveReadResource.ENCOUNTER_LIST, actorUserId: staff.userId, hospitalId: staff.hospitalId, metadata: { workflow: 'CLINIC_APPOINTMENT', view: 'care_queue', count: scoped.length } });
    return scoped.map((row) => {
      const intakeId = row.intakeSessions[0]?.id ?? -1;
      const state = stateByIntake.get(intakeId);
      const handoff = queueHandoffSummary({
        state,
        patientIntake: intakeByIntake.get(intakeId) ?? null,
        encounterComplaint: row.chiefComplaint,
        patient: { age: row.patient.age, gender: row.patient.gender, allergies: row.patient.allergies, conditions: row.patient.conditions },
      });
      return {
        id: row.id, patientId: row.patientId, patientName: [row.patient.firstName, row.patient.lastName].filter(Boolean).join(' ') || 'Patient',
        age: row.patient.age, gender: row.patient.gender, chiefComplaint: row.chiefComplaint, status: row.status,
        arrivedAt: row.arrivedAt, seenAt: row.seenAt, departedAt: row.departedAt,
        assessmentStatus: stringValue(asRecord(state).status) || 'not_started',
        briefing: handoff?.briefing ?? null,
        urgency: handoff?.urgency ?? null,
        redFlagCount: handoff?.redFlagCount ?? 0,
        emergency: emergencyMarker(state),
        clinicQuestions: clinicQuestionsByIntake.get(intakeId) ?? 'none',
      };
    });
  }

  async state(staff: Staff, encounterId: number) {
    await this.encounter(staff, encounterId);
    const snapshot = await this.prisma.$transaction((tx) => this.ensureSnapshot(tx, encounterId, staff.hospitalId, false));
    const canGiveFeedback = CARE_WRITE_ROLES.has(staff.role);
    const [encounter, note, comments, openQuestions, intake, handoffOverride, snapshotHistory, myFeedback] = await Promise.all([
      this.prisma.encounter.findUniqueOrThrow({ where: { id_hospitalId: { id: encounterId, hospitalId: staff.hospitalId } }, include: { patient: { select: { firstName: true, lastName: true, age: true, gender: true, allergies: true, conditions: true, optionalHealthInfo: true } }, contact: true, clinicAppointment: { select: { status: true, requestedStartAt: true, confirmedStartAt: true, timezone: true } } } }),
      this.prisma.careNote.findUnique({ where: { encounterId }, include: { revisions: { orderBy: { version: 'desc' }, take: 20, select: { version: true, kind: true, reason: true, actorUserId: true, createdAt: true } } } }),
      this.prisma.careAssessmentComment.findMany({ where: { encounterId, hospitalId: staff.hospitalId }, orderBy: { createdAt: 'asc' }, include: { revisions: { orderBy: { version: 'desc' }, take: 10, select: { version: true, actorUserId: true, createdAt: true } } } }),
      this.prisma.careOpenQuestion.findMany({ where: { encounterId, hospitalId: staff.hospitalId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.intakeSession.findFirst({ where: { encounterId }, orderBy: { createdAt: 'desc' }, select: { id: true } }),
      this.prisma.careHandoffOverride.findUnique({ where: { encounterId }, select: { reason: true, actorUserId: true, createdAt: true } }),
      this.prisma.careAssessmentSnapshot.findMany({ where: { encounterId, hospitalId: staff.hospitalId }, orderBy: { version: 'desc' } }),
      // Each clinician sees only their own feedback; admins see totals in analytics.
      canGiveFeedback
        ? this.prisma.careAiFeedback.findMany({ where: { encounterId, hospitalId: staff.hospitalId, actorUserId: staff.userId }, orderBy: { createdAt: 'asc' }, select: { snapshotId: true, targetKey: true, segmentId: true, sectionKey: true, kind: true, note: true, updatedAt: true } })
        : Promise.resolve([]),
    ]);
    const interviewState = intake ? await this.prisma.contextItem.findFirst({ where: { intakeSessionId: intake.id, itemType: 'ai_interview_state', supersededBy: { none: {} } }, select: { payload: true } }) : null;
    await this.audit.record({ resource: SensitiveReadResource.ENCOUNTER_DETAIL, actorUserId: staff.userId, hospitalId: staff.hospitalId, encounterId, patientId: encounter.patientId, metadata: { workflow: 'CLINIC_APPOINTMENT', view: 'care', snapshotId: snapshot?.id ?? null } });
    return {
      encounter: { id: encounter.id, status: encounter.status, chiefComplaint: encounter.chiefComplaint, details: encounter.details, arrivedAt: encounter.arrivedAt, seenAt: encounter.seenAt, departedAt: encounter.departedAt, patient: encounter.patient, contact: encounter.contact, appointment: encounter.clinicAppointment },
      assessmentStatus: stringValue(asRecord(interviewState?.payload).status) || 'not_started',
      snapshot: snapshot ? { id: snapshot.id, version: snapshot.version, partial: snapshot.partial, createdAt: snapshot.createdAt, content: snapshot.content as unknown as CareSnapshotContent } : null,
      snapshots: snapshotHistory.map((item) => ({ id: item.id, version: item.version, partial: item.partial, createdAt: item.createdAt, content: item.content as unknown as CareSnapshotContent })),
      note: note ? { text: note.text, version: note.version, finalizedAt: note.finalizedAt, updatedAt: note.updatedAt, updatedByUserId: note.updatedByUserId, history: note.revisions } : { text: '', version: 0, finalizedAt: null, updatedAt: null, updatedByUserId: null, history: [] },
      comments, openQuestions, handoffOverride, myFeedback,
      allowedActions: { start: encounter.status === EncounterStatus.ADMITTED && CARE_WRITE_ROLES.has(staff.role), edit: CARE_EDIT_STATUSES.has(encounter.status) && CARE_WRITE_ROLES.has(staff.role), finish: encounter.status === EncounterStatus.CARE && CARE_WRITE_ROLES.has(staff.role), feedback: canGiveFeedback },
    };
  }

  /**
   * Freezes the assessment Care reads. A snapshot is immutable once comments
   * can reference it (CARE and later); while the visit is still ADMITTED, a
   * snapshot from an older format or rules version is replaced by a new version.
   */
  private async ensureSnapshot(tx: Prisma.TransactionClient, encounterId: number, hospitalId: number, allowPartial: boolean) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74003, ${encounterId})`;
    const existing = await tx.careAssessmentSnapshot.findFirst({ where: { encounterId, hospitalId }, orderBy: { version: 'desc' } });
    const intake = await tx.intakeSession.findFirst({ where: { encounterId, hospitalId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    if (!intake) return existing;
    const states = await tx.contextItem.findMany({ where: { intakeSessionId: intake.id, itemType: 'ai_interview_state' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { payload: true, createdAt: true, supersededBy: { select: { id: true } } } });
    const current = [...states].reverse().find((item) => item.supersededBy.length === 0);
    const complete = asRecord(current?.payload).status === 'complete';
    const visit = await tx.encounter.findUniqueOrThrow({ where: { id: encounterId }, select: { status: true, chiefComplaint: true, patient: { select: { age: true, gender: true, allergies: true, conditions: true } } } });
    const outdated = !!existing && visit.status === EncounterStatus.ADMITTED
      && !(isSnapshotV2(existing.content) && existing.content.handoffGenerator.rulesVersion === CLINIC_HANDOFF_RULES_VERSION);
    if (!complete && (!allowPartial || existing) && !(outdated && existing?.partial)) return existing;
    if (complete && existing && !existing.partial && !outdated) return existing;
    const [answerItems, intakeItem, projection, clinicResponse, clinicVersion] = await Promise.all([
      tx.contextItem.findMany({ where: { intakeSessionId: intake.id, itemType: 'ai_interview_answer' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { payload: true, answerEntryMode: true, enteredByUserId: true } }),
      tx.contextItem.findFirst({ where: { intakeSessionId: intake.id, itemType: 'patient_intake' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { payload: true } }),
      tx.summaryProjection.findFirst({ where: { intakeSessionId: intake.id, kind: SummaryProjectionKind.AI_DERIVED, active: true }, orderBy: { createdAt: 'desc' }, select: { content: true, createdAt: true } }),
      tx.contextItem.findFirst({ where: { intakeSessionId: intake.id, itemType: CLINIC_RESPONSE_ITEM }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { payload: true, createdAt: true } }),
      this.questionnaire.activeVersion(hospitalId, tx),
    ]);
    const intakePayload = asRecord(intakeItem?.payload);
    const content = buildCareSnapshotContentV2({
      states: states.map((item) => ({ payload: item.payload, createdAt: item.createdAt })),
      answerItems,
      projection,
      patientIntake: intakeItem ? { chiefComplaint: stringValue(intakePayload.chiefComplaint) || null, details: stringValue(intakePayload.details) || null } : null,
      encounterComplaint: visit.chiefComplaint,
      patient: visit.patient,
      complete,
      clinicResponse,
      clinicQuestionsExpected: !!clinicVersion,
    });
    return tx.careAssessmentSnapshot.create({ data: { encounterId, hospitalId, version: (existing?.version ?? 0) + 1, partial: !complete, content: content as unknown as Prisma.InputJsonValue } });
  }

  async start(staff: Staff, encounterId: number, dto: StartCareDto) {
    await this.encounter(staff, encounterId, true);
    const reason = dto.urgentOverrideReason?.trim() || '';
    const event = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74004, ${encounterId})`;
      const visit = await tx.encounter.findUniqueOrThrow({ where: { id_hospitalId: { id: encounterId, hospitalId: staff.hospitalId } }, select: { status: true } });
      if (visit.status === EncounterStatus.CARE) return null;
      if (visit.status !== EncounterStatus.ADMITTED) throw new ConflictException('Only arrived clinic visits can enter Care');
      const snapshot = await this.ensureSnapshot(tx, encounterId, staff.hospitalId, !!reason);
      if (!snapshot || (snapshot.partial && !reason)) throw new ConflictException('Complete the assessment before routine Care handoff');
      if (reason && reason.length < 10) throw new BadRequestException('Provide a specific urgent-care override reason');
      if (reason) await tx.careHandoffOverride.create({ data: { encounterId, hospitalId: staff.hospitalId, reason, actorUserId: staff.userId } });
      await tx.encounter.update({ where: { id: encounterId }, data: { status: EncounterStatus.CARE, seenAt: new Date() } });
      return this.events.emitEncounterEventTx(tx, { encounterId, hospitalId: staff.hospitalId, type: EventType.STATUS_CHANGE, actor: { actorUserId: staff.userId }, metadata: { workflow: 'CLINIC_APPOINTMENT', fromStatus: 'ADMITTED', toStatus: 'CARE', urgentOverride: !!reason, commandKey: dto.commandKey, snapshotId: snapshot.id } });
    });
    if (event) void this.events.dispatchEncounterEventAndMarkProcessed(event);
    return this.state(staff, encounterId);
  }

  async saveNote(staff: Staff, encounterId: number, dto: SaveCareNoteDto) {
    const visit = await this.encounter(staff, encounterId, true);
    if (!CARE_EDIT_STATUSES.has(visit.status)) throw new ConflictException('Start Care before writing the physician note');
    const reason = dto.amendmentReason?.trim() || '';
    if (visit.status === EncounterStatus.COMPLETE && reason.length < 10) throw new BadRequestException('A completed note needs an amendment reason');
    const event = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74004, ${encounterId})`;
      const encounter = await tx.encounter.findUniqueOrThrow({ where: { id: encounterId }, select: { status: true } });
      if (!CARE_EDIT_STATUSES.has(encounter.status)) throw new ConflictException('Care is no longer editable');
      if (encounter.status === EncounterStatus.COMPLETE && reason.length < 10) throw new BadRequestException('A completed note needs an amendment reason');
      const note = await tx.careNote.upsert({ where: { encounterId }, create: { encounterId, hospitalId: staff.hospitalId }, update: {} });
      if (note.text === dto.text && note.version >= dto.expectedVersion) return null;
      if (note.version !== dto.expectedVersion) throw new ConflictException('The physician note changed on another device');
      const version = note.version + 1;
      await tx.careNote.update({ where: { id: note.id }, data: { text: dto.text, version, updatedByUserId: staff.userId } });
      await tx.careNoteRevision.create({ data: { careNoteId: note.id, version, text: dto.text, kind: encounter.status === EncounterStatus.COMPLETE ? 'AMENDMENT' : 'AUTOSAVE', reason: reason || null, actorUserId: staff.userId } });
      return this.events.emitEncounterEventTx(tx, { encounterId, hospitalId: staff.hospitalId, type: EventType.CARE_UPDATED, actor: { actorUserId: staff.userId }, metadata: { workflow: 'CLINIC_APPOINTMENT', kind: 'note', version } });
    });
    if (event) void this.events.dispatchEncounterEventAndMarkProcessed(event);
    return this.state(staff, encounterId);
  }

  async finish(staff: Staff, encounterId: number, dto: FinishCareDto) {
    await this.encounter(staff, encounterId, true);
    const event = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74004, ${encounterId})`;
      const encounter = await tx.encounter.findUniqueOrThrow({ where: { id_hospitalId: { id: encounterId, hospitalId: staff.hospitalId } }, include: { clinicAppointment: true } });
      if (encounter.status === EncounterStatus.COMPLETE) return null;
      if (encounter.status !== EncounterStatus.CARE) throw new ConflictException('Start Care before finishing the visit');
      const note = await tx.careNote.upsert({ where: { encounterId }, create: { encounterId, hospitalId: staff.hospitalId }, update: {} });
      if (note.version !== dto.noteVersion) throw new ConflictException('Save and review the latest physician note before finishing');
      const now = new Date();
      await tx.careNote.update({ where: { id: note.id }, data: { version: { increment: 1 }, finalizedAt: now, updatedByUserId: staff.userId } });
      await tx.careNoteRevision.create({ data: { careNoteId: note.id, version: note.version + 1, text: note.text, kind: 'FINAL', actorUserId: staff.userId } });
      await tx.encounter.update({ where: { id: encounterId }, data: { status: EncounterStatus.COMPLETE, departedAt: now } });
      if (encounter.clinicAppointment) {
        await tx.clinicAppointment.update({ where: { id: encounter.clinicAppointment.id }, data: { status: ClinicAppointmentStatus.COMPLETED, resolvedAt: now, resolvedByUserId: staff.userId, revision: { increment: 1 } } });
        await this.notifications.cancelPendingTx(tx, encounter.clinicAppointment.id, 'visit_completed');
      }
      return this.events.emitEncounterEventTx(tx, { encounterId, hospitalId: staff.hospitalId, type: EventType.STATUS_CHANGE, actor: { actorUserId: staff.userId }, metadata: { workflow: 'CLINIC_APPOINTMENT', fromStatus: 'CARE', toStatus: 'COMPLETE', commandKey: dto.commandKey } });
    });
    if (event) void this.events.dispatchEncounterEventAndMarkProcessed(event);
    return this.state(staff, encounterId);
  }

  async addComment(staff: Staff, encounterId: number, dto: CreateCareCommentDto) {
    const visit = await this.encounter(staff, encounterId, true);
    if (visit.status !== EncounterStatus.CARE) throw new ConflictException('Comments can be added during Care');
    const event = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74004, ${encounterId})`;
      const active = await tx.encounter.findUniqueOrThrow({ where: { id: encounterId }, select: { status: true } });
      if (active.status !== EncounterStatus.CARE) throw new ConflictException('Care is no longer open for comments');
      const duplicate = await tx.careAssessmentComment.findUnique({ where: { commandKey: dto.commandKey } });
      if (duplicate) { if (duplicate.encounterId !== encounterId || duplicate.hospitalId !== staff.hospitalId) throw new ConflictException('Comment key already used'); return null; }
      const snapshot = await tx.careAssessmentSnapshot.findFirst({ where: { id: dto.snapshotId, encounterId, hospitalId: staff.hospitalId } });
      if (!snapshot) throw new NotFoundException('Assessment snapshot not found');
      const segment = ((snapshot.content as unknown as CareSnapshotContent).segments || []).find((item) => item.id === dto.segmentId);
      if (!segment || dto.startOffset >= dto.endOffset || segment.text.slice(dto.startOffset, dto.endOffset) !== dto.quote) throw new BadRequestException('The selected assessment passage changed; select it again');
      if (!dto.text.trim()) throw new BadRequestException('Comment text is required');
      const comment = await tx.careAssessmentComment.create({ data: { commandKey: dto.commandKey, encounterId, hospitalId: staff.hospitalId, snapshotId: snapshot.id, segmentId: segment.id, startOffset: dto.startOffset, endOffset: dto.endOffset, quote: dto.quote, text: dto.text.trim(), actorUserId: staff.userId, updatedByUserId: staff.userId } });
      await tx.careCommentRevision.create({ data: { commentId: comment.id, version: 1, text: comment.text, actorUserId: staff.userId } });
      return this.events.emitEncounterEventTx(tx, { encounterId, hospitalId: staff.hospitalId, type: EventType.CARE_UPDATED, actor: { actorUserId: staff.userId }, metadata: { workflow: 'CLINIC_APPOINTMENT', kind: 'comment', commentId: comment.id } });
    });
    if (event) void this.events.dispatchEncounterEventAndMarkProcessed(event);
    return this.state(staff, encounterId);
  }

  async updateComment(staff: Staff, encounterId: number, commentId: number, dto: UpdateCareCommentDto) {
    const visit = await this.encounter(staff, encounterId, true);
    if (visit.status !== EncounterStatus.CARE) throw new ConflictException('Comments can be edited during Care');
    const event = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74004, ${encounterId})`;
      const active = await tx.encounter.findUniqueOrThrow({ where: { id: encounterId }, select: { status: true } });
      if (active.status !== EncounterStatus.CARE) throw new ConflictException('Care is no longer open for comments');
      const comment = await tx.careAssessmentComment.findFirst({ where: { id: commentId, encounterId, hospitalId: staff.hospitalId } });
      if (!comment) throw new NotFoundException('Comment not found');
      if (comment.version !== dto.expectedVersion) throw new ConflictException('Comment changed on another device');
      const text = dto.text === undefined ? comment.text : dto.text.trim();
      if (!text) throw new BadRequestException('Comment text is required');
      const resolvedAt = dto.resolved === undefined ? comment.resolvedAt : dto.resolved ? new Date() : null;
      const version = comment.version + 1;
      await tx.careAssessmentComment.update({ where: { id: comment.id }, data: { text, resolvedAt, version, updatedByUserId: staff.userId } });
      await tx.careCommentRevision.create({ data: { commentId: comment.id, version, text, resolvedAt, actorUserId: staff.userId } });
      return this.events.emitEncounterEventTx(tx, { encounterId, hospitalId: staff.hospitalId, type: EventType.CARE_UPDATED, actor: { actorUserId: staff.userId }, metadata: { workflow: 'CLINIC_APPOINTMENT', kind: 'comment', commentId, version } });
    });
    if (event) void this.events.dispatchEncounterEventAndMarkProcessed(event);
    return this.state(staff, encounterId);
  }

  async addOpenQuestion(staff: Staff, encounterId: number, dto: CreateCareQuestionDto) {
    const visit = await this.encounter(staff, encounterId, true);
    if (visit.status !== EncounterStatus.CARE) throw new ConflictException('Start Care before adding open questions');
    if (!dto.text.trim()) throw new BadRequestException('Question text is required');
    const event = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74004, ${encounterId})`;
      const active = await tx.encounter.findUniqueOrThrow({ where: { id: encounterId }, select: { status: true } });
      if (active.status !== EncounterStatus.CARE) throw new ConflictException('Care is no longer open for questions');
      const duplicate = await tx.careOpenQuestion.findUnique({ where: { commandKey: dto.commandKey } });
      if (duplicate) { if (duplicate.encounterId !== encounterId || duplicate.hospitalId !== staff.hospitalId) throw new ConflictException('Question key already used'); return null; }
      const source = dto.sourceSegmentId ? await this.askInRoomSource(tx, encounterId, staff.hospitalId, dto) : null;
      const addressedAt = dto.addressed ? new Date() : null;
      if (source) {
        // Ticking an item someone already ticked on another screen just marks it asked.
        const existing = await tx.careOpenQuestion.findFirst({ where: { encounterId, snapshotId: source.snapshotId, sourceSegmentId: source.sourceSegmentId } });
        if (existing) {
          if (existing.addressedAt || !addressedAt) return null;
          await tx.careOpenQuestion.update({ where: { id: existing.id }, data: { addressedAt, version: { increment: 1 }, updatedByUserId: staff.userId } });
          return this.events.emitEncounterEventTx(tx, { encounterId, hospitalId: staff.hospitalId, type: EventType.CARE_UPDATED, actor: { actorUserId: staff.userId }, metadata: { workflow: 'CLINIC_APPOINTMENT', kind: 'open_question', questionId: existing.id } });
        }
      }
      const item = await tx.careOpenQuestion.create({ data: { commandKey: dto.commandKey, encounterId, hospitalId: staff.hospitalId, text: source?.text ?? dto.text.trim(), addressedAt, snapshotId: source?.snapshotId ?? null, sourceSegmentId: source?.sourceSegmentId ?? null, actorUserId: staff.userId, updatedByUserId: staff.userId } });
      return this.events.emitEncounterEventTx(tx, { encounterId, hospitalId: staff.hospitalId, type: EventType.CARE_UPDATED, actor: { actorUserId: staff.userId }, metadata: { workflow: 'CLINIC_APPOINTMENT', kind: 'open_question', questionId: item.id } });
    });
    if (event) void this.events.dispatchEncounterEventAndMarkProcessed(event);
    return this.state(staff, encounterId);
  }

  async updateOpenQuestion(staff: Staff, encounterId: number, questionId: number, dto: UpdateCareQuestionDto) {
    const visit = await this.encounter(staff, encounterId, true);
    if (visit.status !== EncounterStatus.CARE) throw new ConflictException('Open questions can be updated during Care');
    const event = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74004, ${encounterId})`;
      const active = await tx.encounter.findUniqueOrThrow({ where: { id: encounterId }, select: { status: true } });
      if (active.status !== EncounterStatus.CARE) throw new ConflictException('Care is no longer open for questions');
      const item = await tx.careOpenQuestion.findFirst({ where: { id: questionId, encounterId, hospitalId: staff.hospitalId } });
      if (!item) throw new NotFoundException('Open question not found');
      if (item.version !== dto.expectedVersion) throw new ConflictException('Open question changed on another device');
      const text = dto.text === undefined ? item.text : dto.text.trim();
      if (!text) throw new BadRequestException('Question text is required');
      const addressedAt = dto.addressed === undefined ? item.addressedAt : dto.addressed ? new Date() : null;
      const answerText = dto.answerText === undefined ? item.answerText : dto.answerText.trim() || null;
      await tx.careOpenQuestion.update({ where: { id: questionId }, data: { text, addressedAt, answerText, version: { increment: 1 }, updatedByUserId: staff.userId } });
      return this.events.emitEncounterEventTx(tx, { encounterId, hospitalId: staff.hospitalId, type: EventType.CARE_UPDATED, actor: { actorUserId: staff.userId }, metadata: { workflow: 'CLINIC_APPOINTMENT', kind: 'open_question', questionId } });
    });
    if (event) void this.events.dispatchEncounterEventAndMarkProcessed(event);
    return this.state(staff, encounterId);
  }

  /** The "Ask in the room" item a ticked question came from, read from the stored snapshot. */
  private async askInRoomSource(tx: Prisma.TransactionClient, encounterId: number, hospitalId: number, dto: CreateCareQuestionDto) {
    if (!dto.snapshotId) throw new BadRequestException('Say which assessment version the item is from');
    const snapshot = await tx.careAssessmentSnapshot.findFirst({ where: { id: dto.snapshotId, encounterId, hospitalId }, select: { id: true, content: true } });
    if (!snapshot) throw new NotFoundException('Assessment snapshot not found');
    const segment = ((snapshot.content as unknown as CareSnapshotContent).segments || []).find((item) => item.id === dto.sourceSegmentId && item.section === 'ask_in_room');
    if (!segment) throw new BadRequestException('That question isn’t in this assessment’s Ask in the room list');
    return { snapshotId: snapshot.id, sourceSegmentId: segment.id, text: segment.text };
  }

  async setFeedback(staff: Staff, encounterId: number, dto: CareFeedbackDto) {
    await this.encounter(staff, encounterId, true);
    const snapshot = await this.prisma.careAssessmentSnapshot.findFirst({ where: { id: dto.snapshotId, encounterId, hospitalId: staff.hospitalId }, select: { id: true, content: true } });
    if (!snapshot) throw new NotFoundException('Assessment snapshot not found');
    const content = snapshot.content as unknown as CareSnapshotContent;
    if (!isSnapshotV2(content)) throw new BadRequestException('Feedback needs an assessment from the current version');
    let target;
    try { target = feedbackTarget(content, dto); }
    catch (error) { if (error instanceof CareFeedbackError) throw new BadRequestException(error.message); throw error; }
    const data = { segmentId: target.segmentId, sectionKey: target.sectionKey, ruleId: target.ruleId, generatorKind: target.generatorKind, generatorVersion: target.generatorVersion, kind: dto.kind, note: target.note };
    await this.prisma.careAiFeedback.upsert({
      where: { snapshotId_actorUserId_targetKey: { snapshotId: snapshot.id, actorUserId: staff.userId, targetKey: target.targetKey } },
      create: { encounterId, hospitalId: staff.hospitalId, snapshotId: snapshot.id, targetKey: target.targetKey, actorUserId: staff.userId, ...data },
      update: data,
    });
    return this.state(staff, encounterId);
  }

  async clearFeedback(staff: Staff, encounterId: number, dto: ClearCareFeedbackDto) {
    await this.encounter(staff, encounterId, true);
    await this.prisma.careAiFeedback.deleteMany({ where: { encounterId, hospitalId: staff.hospitalId, snapshotId: dto.snapshotId, actorUserId: staff.userId, targetKey: dto.targetKey } });
    return this.state(staff, encounterId);
  }

  async exportText(staff: Staff, encounterId: number) {
    const state = await this.state(staff, encounterId);
    await this.audit.record({ resource: SensitiveReadResource.ENCOUNTER_DETAIL, actorUserId: staff.userId, hospitalId: staff.hospitalId, encounterId, metadata: { workflow: 'CLINIC_APPOINTMENT', action: 'care_export_text', snapshotId: state.snapshot?.id ?? null } });
    return { filename: `priage-visit-${encounterId}.txt`, text: formatCareExport(state) };
  }

  async copyAudit(staff: Staff, encounterId: number, dto: CareCopyAuditDto) {
    await this.encounter(staff, encounterId);
    const sections = [...new Set([dto.section, ...(dto.sections ?? [])])];
    for (const section of sections) {
      await this.audit.record({ resource: SensitiveReadResource.ENCOUNTER_DETAIL, actorUserId: staff.userId, hospitalId: staff.hospitalId, encounterId, metadata: { workflow: 'CLINIC_APPOINTMENT', action: 'care_copy', section, snapshotId: dto.snapshotId ?? null } });
    }
    return { recorded: true };
  }
}

const STAGE_HEADINGS: Record<string, string> = { red_flag_screen: 'Red-flag screen', narrowing: 'Narrowing it down', history: 'History' };

export function formatCareExport(state: Awaited<ReturnType<ClinicCareService['state']>>): string {
  const { encounter, snapshot, note, comments, openQuestions } = state;
  const v2 = snapshot && isSnapshotV2(snapshot.content) ? snapshot.content : null;
  const lines = [
    `Priage clinic visit #${encounter.id}`,
    `Patient: ${[encounter.patient.firstName, encounter.patient.lastName].filter(Boolean).join(' ') || 'Patient'}`,
    `Age: ${encounter.patient.age ?? 'Not recorded'}`,
    `Sex/gender: ${encounter.patient.gender || 'Not recorded'}`,
    `Complaint: ${v2?.visitRecord.chiefComplaint || encounter.chiefComplaint || 'Not recorded'}`,
    // A v2 snapshot keeps the patient's own note; encounter.details can hold generated text.
    v2 ? `Patient's note: ${v2.visitRecord.patientNote || 'None'}` : `Visit details: ${encounter.details || 'Not recorded'}`,
    `Allergies: ${encounter.patient.allergies || 'Not recorded'}`,
    `Conditions: ${encounter.patient.conditions || 'Not recorded'}`,
    `Visit status: ${encounter.status}`,
    `Arrived: ${encounter.arrivedAt?.toISOString() || 'Not recorded'}`,
  ];
  if (!v2 && encounter.patient.optionalHealthInfo) lines.push(`Other patient information: ${JSON.stringify(encounter.patient.optionalHealthInfo)}`);
  if (state.handoffOverride) lines.push(`Urgent Care override: ${state.handoffOverride.reason} (user #${state.handoffOverride.actorUserId})`);
  if (snapshot && v2) {
    const segmentText = (id: string) => v2.segments.find((segment) => segment.id === id)?.text ?? '';
    lines.push(
      `Assessment snapshot: v${snapshot.version}${snapshot.partial ? ' (unfinished, urgent Care override)' : ''}`,
      `Assessment source: ${v2.generationMode === 'ai' ? 'Model-generated decision support' : 'Deterministic preview'}; handoff rules ${v2.handoffGenerator.rulesVersion}`,
      `Assessment generated: ${v2.generatedAt || 'Not available'}`,
      '', 'BEFORE YOU GO IN (generated decision support, review against the answers)',
      `Urgency: ${v2.urgency.sentence}`,
      ...v2.urgency.reasons.map((reason) => `- ${reason.text}`),
      `Briefing: ${v2.summary.briefing}`,
    );
    if (v2.redFlags.length) lines.push('', 'Red flags', ...v2.redFlags.map((flag) => `- ${flag.label}`));
    if (v2.emergencyEvents.length) lines.push('', 'Emergency warnings', ...v2.emergencyEvents.map((event, index) => `- ${segmentText(`emergency:${index}`)} Shown ${event.shownAt}${event.acknowledgedAt ? `, continued ${event.acknowledgedAt}` : ''}.`));
    if (v2.nextSteps.length) lines.push('', 'Next steps', ...v2.nextSteps.map((step) => `- ${step.text}`));
    if (v2.askInRoom.length) lines.push('', 'Ask in the room', ...v2.askInRoom.map((item) => `- ${item.priority === 'must' ? '[Must ask] ' : ''}${item.text} (${item.why})`));
    if (v2.gaps.length) lines.push('', 'Not established', ...v2.gaps.map((gap) => `- ${gap.text}`));
    if (v2.considerations.length) lines.push('', 'Possible considerations', ...v2.considerations.map((item) => `- ${item.text}`));
    if (v2.examSuggestions.length) lines.push('', 'Focused exam suggestions', ...v2.examSuggestions.map((item) => `- ${item.text} (${item.why})`));
    if (v2.timedRisks.length) lines.push('', 'Watch for', ...v2.timedRisks.map((item) => `- ${item.text}${item.window ? ` (${item.window})` : ''}`));
    lines.push('', 'Case summary', v2.summary.caseSummary, '', 'PATIENT ANSWERS');
    const groups: Array<[string, typeof v2.answers]> = [
      ['Safety check', v2.answers.filter((answer) => answer.source === 'safety')],
      ['Clinic questions', v2.answers.filter((answer) => answer.source === 'clinic')],
      ...(['red_flag_screen', 'narrowing', 'history'] as const).map((stage): [string, typeof v2.answers] => [STAGE_HEADINGS[stage], v2.answers.filter((answer) => answer.source === 'ai' && answer.stage === stage)]),
      ['Other questions', v2.answers.filter((answer) => answer.source === 'ai' && !answer.stage)],
    ];
    for (const [heading, answers] of groups) {
      if (!answers.length) continue;
      lines.push('', heading);
      for (const answer of answers) lines.push(`Q: ${answer.question}`, `A: ${answer.answer}`, ...(answer.why ? [`Why asked: ${answer.why}`] : []), `Entered: ${answer.entryMode === 'STAFF_ASSISTED' ? `Staff-assisted (user #${answer.enteredByUserId ?? 'unknown'})` : 'Patient self-entry'} at ${answer.answeredAt}`, '');
    }
    if (v2.unasked.length) lines.push('GENERATED QUESTIONS NOT ASKED', ...v2.unasked.map((item) => `- ${item.question}`), '');
  } else if (snapshot) {
    const content = snapshot.content;
    lines.push(`Assessment snapshot: v${snapshot.version}${snapshot.partial ? ' (partial, urgent Care override)' : ''}`, `Assessment source: ${content.generationMode === 'ai' ? 'Model-generated decision support' : 'Deterministic preview/fallback'}`, `Assessment generated: ${content.generatedAt || 'Not available'}`, '', 'GENERATED ASSESSMENT', content.summary.briefing, content.summary.caseSummary, `Suggested action: ${content.summary.recommendedAction || 'None recorded'}`);
    if (content.summary.redFlags.length) lines.push('', 'Generated red flags', ...content.summary.redFlags.map((value) => `- ${value}`));
    if (content.summary.progressionRisks.length) lines.push('', 'Generated progression considerations', ...content.summary.progressionRisks.map((value) => `- ${value}`));
    lines.push('', 'PATIENT ASSESSMENT QUESTIONS AND ANSWERS');
    for (const answer of content.answers) lines.push(`Q: ${answer.question}`, `A: ${answer.answer}`, `Entered: ${answer.entryMode === 'STAFF_ASSISTED' ? `Staff-assisted (user #${answer.enteredByUserId ?? 'unknown'})` : 'Patient self-entry'} at ${answer.answeredAt}`, '');
    if (content.unasked.length) lines.push('GENERATED PROMPTS NOT ASKED', ...content.unasked.map((item) => `- ${item.question}`), '');
  } else lines.push('', 'Assessment not yet available.');
  if (openQuestions.length) {
    lines.push('CLINICIAN OPEN QUESTIONS', ...openQuestions.flatMap((item) => [
      `- ${item.text} [${item.addressedAt ? 'addressed' : 'open'}]${item.sourceSegmentId ? ' (from Ask in the room)' : ''}`,
      ...(item.answerText ? [`  Answer (clinician’s record): ${item.answerText}`] : []),
    ]), '');
  }
  if (comments.length) lines.push('CLINICIAN ASSESSMENT COMMENTS', ...comments.map((item) => `- On “${item.quote}”: ${item.text}${item.resolvedAt ? ' [resolved]' : ''}`), '');
  lines.push('PHYSICIAN NOTE', note.text || '(No note recorded)', `Note version: ${note.version}${note.finalizedAt ? ' (finalized)' : ''}`);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
