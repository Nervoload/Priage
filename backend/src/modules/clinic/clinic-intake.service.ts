import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ContextSourceType, EncounterStatus, EventType, IntakeSessionStatus, InterviewAnswerEntryMode, Prisma, ReviewState, SensitiveReadResource, TrustTier, VisibilityScope } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';

import { PATIENT_SESSION_TTL_MS } from '../../common/http/auth-cookie.util';
import { PatientContext } from '../auth/guards/patient.guard';
import { EventsService } from '../events/events.service';
import { SensitiveReadAuditService } from '../audit/sensitive-read-audit.service';
import { IntakeSessionsService } from '../intake-sessions/intake-sessions.service';
import { readAssessmentConfig } from '../assessment/assessment-config';
import { AdvanceAssessmentDto, StartAssessmentDto } from '../assessment/dto/assessment.dto';
import { buildGuestPlaceholderPasswordHash } from '../patient-auth/patient-password.util';
import { generatePatientSessionToken, hashPatientSessionToken } from '../patient-auth/patient-session-token.util';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicAssessmentService } from './clinic-assessment.service';
import { ClinicPilotService } from './clinic-pilot.service';
import { ClinicEntryService } from './clinic-entry.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateClinicWalkInDto, StartClinicVisitDto } from './dto/clinic-intake.dto';
import { ClinicQuestionnaireService } from './questionnaire/clinic-questionnaire.service';
import { ACTIVE_ENCOUNTER_STATUSES, isActiveEncounterStatus } from '../../shared/types/encounter-status';

const DESK_GRANT_TTL_MS = 10 * 60_000;
const DESK_SESSION_TTL_MS = 30 * 60_000;

type Staff = { userId: number; hospitalId: number };

@Injectable()
export class ClinicIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pilot: ClinicPilotService,
    private readonly entry: ClinicEntryService,
    private readonly intakeSessions: IntakeSessionsService,
    private readonly assessment: ClinicAssessmentService,
    private readonly events: EventsService,
    private readonly audit: SensitiveReadAuditService,
    private readonly notifications: NotificationsService,
    private readonly questionnaire: ClinicQuestionnaireService,
  ) {}

  async clinicMetadata() {
    const hospitalId = this.pilot.assertPreviewEnabled();
    const [clinic, schedule, published] = await Promise.all([
      this.prisma.hospital.findUnique({ where: { id: hospitalId }, select: { id: true, slug: true, name: true } }),
      this.prisma.clinicSchedule.findUnique({ where: { hospitalId }, select: { hospitalId: true } }),
      this.prisma.legalDocumentVersion.findMany({ where: { publishedAt: { lte: new Date() } }, select: { kind: true }, distinct: ['kind'] }),
    ]);
    if (!clinic) throw new NotFoundException();
    return { ...clinic, preview: true, appointmentBookingAvailable: !!schedule && published.some((document) => document.kind === 'TERMS') && published.some((document) => document.kind === 'PRIVACY'), assessmentEngine: readAssessmentConfig().engine === 'harness' ? 'assessment_harness' : 'deterministic_preview' };
  }

  async startGuest(dto: StartClinicVisitDto, existingToken?: string, selectedHospitalId?: number) {
    const hospitalId = selectedHospitalId ? this.pilot.assertTenantEnabled(selectedHospitalId) : this.pilot.assertPreviewEnabled();
    const existing = await this.findStartRetry(dto, existingToken, undefined, hospitalId);
    if (existing) return existing;
    if (existingToken) {
      const session = await this.prisma.patientSession.findUnique({
        where: { token: hashPatientSessionToken(existingToken) },
        select: {
          expiresAt: true,
          patient: { select: { accountEnabled: true } },
          encounter: { select: { status: true } },
        },
      });
      if (session && (!session.expiresAt || session.expiresAt > new Date())) {
        if (session.patient.accountEnabled) throw new ConflictException('Use the account visit start for a signed-in patient');
        if (session.encounter && isActiveEncounterStatus(session.encounter.status)) throw new ConflictException('Patient already has an active visit');
      }
    }
    const token = generatePatientSessionToken();
    const password = await buildGuestPlaceholderPasswordHash();
    const result = await this.prisma.$transaction(async (tx) => {
      const patient = await tx.patientProfile.create({
        data: { email: `${randomUUID()}@intake.local`, password, accountEnabled: false, firstName: dto.firstName?.trim() || null, lastName: dto.lastName?.trim() || null, phone: dto.phone?.trim() || null, age: dto.age ?? null, gender: dto.gender?.trim() || null },
      });
      const authSession = await tx.patientSession.create({
        data: { token: hashPatientSessionToken(token), patientId: patient.id, expiresAt: new Date(Date.now() + PATIENT_SESSION_TTL_MS) },
      });
      const encounter = await this.createVisitTx(tx, hospitalId, patient.id, dto, EncounterStatus.INTAKE, 'clinic_guest', authSession.id);
      return { encounter, sessionToken: token };
    }).catch((error: unknown) => this.handleStartConflict(error));
    return { ...this.toVisit(result.encounter), sessionToken: result.sessionToken };
  }

  async startAccount(dto: StartClinicVisitDto, patient: PatientContext, selectedHospitalId?: number) {
    const hospitalId = selectedHospitalId ? this.pilot.assertTenantEnabled(selectedHospitalId) : this.pilot.assertPreviewEnabled();
    const existing = await this.findStartRetry(dto, undefined, patient, hospitalId);
    if (existing) return existing;
    const encounter = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PatientProfile" WHERE "id" = ${patient.patientId} FOR UPDATE`;
      const profile = await tx.patientProfile.findUnique({ where: { id: patient.patientId }, select: { accountEnabled: true } });
      if (!profile?.accountEnabled) throw new ForbiddenException('A registered patient account is required');
      const active = await tx.encounter.findFirst({ where: { patientId: patient.patientId, status: { in: ACTIVE_ENCOUNTER_STATUSES } }, select: { id: true } });
      if (active) throw new ConflictException('Patient already has an active visit');
      await tx.patientProfile.update({ where: { id: patient.patientId }, data: {
        ...(dto.firstName?.trim() ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName?.trim() ? { lastName: dto.lastName.trim() } : {}),
        ...(dto.phone?.trim() ? { phone: dto.phone.trim() } : {}),
        ...(dto.age !== undefined ? { age: dto.age } : {}),
        ...(dto.gender?.trim() ? { gender: dto.gender.trim() } : {}),
      } });
      return this.createVisitTx(tx, hospitalId, patient.patientId, dto, EncounterStatus.INTAKE, 'clinic_account', patient.sessionId);
    }).catch((error: unknown) => this.handleStartConflict(error));
    return this.toVisit(encounter);
  }

  private async findStartRetry(dto: StartClinicVisitDto, token?: string, patient?: PatientContext, hospitalId?: number) {
    const existing = await this.prisma.encounter.findUnique({ where: { clinicStartKey: dto.startKey }, include: { contact: true } });
    if (!existing) return null;
    this.pilot.assertTenant(existing.hospitalId);
    if (hospitalId !== existing.hospitalId) throw new ConflictException('Visit start belongs to another clinic');
    if (existing.clinicStartFingerprint !== this.fingerprint(dto)) throw new ConflictException('Start key was used for different visit details');
    let session = patient ? await this.prisma.patientSession.findUnique({ where: { id: patient.sessionId } }) : null;
    if (!session && token) session = await this.prisma.patientSession.findUnique({ where: { token: hashPatientSessionToken(token) } });
    if (!session || session.patientId !== existing.patientId || (session.expiresAt && session.expiresAt < new Date())) {
      throw new ConflictException('Visit was already started; resume with the original session');
    }
    return { ...this.toVisit(existing), ...(token ? { sessionToken: token } : {}) };
  }

  private fingerprint(dto: StartClinicVisitDto | CreateClinicWalkInDto) {
    return createHash('sha256').update(JSON.stringify({ email: dto.contactEmail?.trim().toLowerCase() || '', complaint: dto.chiefComplaint.trim(), details: dto.details?.trim() || '', firstName: dto.firstName?.trim() || '', lastName: dto.lastName?.trim() || '', phone: dto.phone?.trim() || '', age: dto.age ?? null, gender: dto.gender?.trim() || '' })).digest('hex');
  }

  private handleStartConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Visit start was already submitted; resume the existing visit');
    throw error;
  }

  private async createVisitTx(
    tx: Prisma.TransactionClient,
    hospitalId: number,
    patientId: number,
    dto: StartClinicVisitDto | CreateClinicWalkInDto,
    status: EncounterStatus,
    source: string,
    authSessionId?: number,
    actorUserId?: number,
  ) {
    const isPrevisit = status === EncounterStatus.INTAKE;
    const encounter = await tx.encounter.create({ data: {
      publicId: `enc_${randomUUID()}`, hospitalId, patientId, status,
      expectedAt: null, arrivedAt: isPrevisit ? null : new Date(),
      chiefComplaint: dto.chiefComplaint.trim(), details: dto.details?.trim() || null,
      clinicStartKey: dto.startKey, clinicStartFingerprint: this.fingerprint(dto),
    } });
    await tx.encounterContact.create({ data: {
      encounterId: encounter.id, hospitalId,
      email: dto.contactEmail?.trim().toLowerCase() || null,
      phone: dto.phone?.trim() || null, source,
      verifiedAt: null,
    } });
    const intake = await tx.intakeSession.create({ data: {
      publicId: `intake_${randomUUID()}`, hospitalId, patientId, encounterId: encounter.id,
      authSessionId: authSessionId ?? null, status: IntakeSessionStatus.CONFIRMED, confirmedAt: new Date(),
    } });
    if (authSessionId) await tx.patientSession.update({ where: { id: authSessionId }, data: { encounterId: encounter.id } });
    await this.intakeSessions.appendContextItemByIntakeSessionIdTx(tx, intake.id, {
      itemType: 'patient_intake', schemaVersion: 'v1',
      payload: { chiefComplaint: dto.chiefComplaint.trim(), details: dto.details?.trim() || null, firstName: dto.firstName?.trim() || null, lastName: dto.lastName?.trim() || null, phone: dto.phone?.trim() || null },
      sourceType: actorUserId ? ContextSourceType.INSTITUTION : ContextSourceType.PATIENT,
      trustTier: TrustTier.UNTRUSTED, reviewState: ReviewState.UNREVIEWED,
      visibilityScope: VisibilityScope.ADMISSIONS, patientId,
      ...(actorUserId ? { enteredByUserId: actorUserId } : {}),
    });
    await this.events.emitEncounterEventTx(tx, { encounterId: encounter.id, hospitalId, type: EventType.ENCOUNTER_CREATED,
      metadata: { status, source, intakeSessionPublicId: intake.publicId },
      actor: actorUserId ? { actorUserId } : { actorPatientId: patientId },
    });
    return encounter;
  }

  async createWalkIn(staff: Staff, dto: CreateClinicWalkInDto) {
    this.assertStaff(staff);
    await this.entry.assertWalkIns(staff.hospitalId);
    const existing = await this.prisma.encounter.findUnique({ where: { clinicStartKey: dto.startKey }, include: { contact: true } });
    if (existing) {
      if (existing.hospitalId !== staff.hospitalId || existing.contact?.source !== 'clinic_walk_in' || existing.clinicStartFingerprint !== this.fingerprint(dto)) {
        throw new ConflictException('Start key was used for different visit details');
      }
      return this.toVisit(existing);
    }
    const password = await buildGuestPlaceholderPasswordHash();
    const encounter = await this.prisma.$transaction(async (tx) => {
      const patient = await tx.patientProfile.create({ data: {
        email: `${randomUUID()}@intake.local`, password, accountEnabled: false,
        firstName: dto.firstName?.trim() || null, lastName: dto.lastName?.trim() || null, phone: dto.phone?.trim() || null,
        age: dto.age ?? null, gender: dto.gender?.trim() || null,
      } });
      return this.createVisitTx(tx, staff.hospitalId, patient.id, dto, EncounterStatus.ADMITTED, 'clinic_walk_in', undefined, staff.userId);
    }).catch((error: unknown) => this.handleStartConflict(error));
    return this.toVisit(encounter);
  }

  async getPatientVisit(encounterId: number, patient: PatientContext) {
    const encounter = await this.patientEncounter(encounterId, patient);
    return { ...this.toVisit(encounter), contactEmail: encounter.contact?.email ?? null, contactVerified: !!encounter.contact?.verifiedAt,
      interviewStatus: await this.assessment.status(this.intakeId(encounter)) };
  }

  async updateContact(encounterId: number, patient: PatientContext, email: string) {
    await this.patientEncounter(encounterId, patient);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74002, ${encounterId})`;
      const encounter = await tx.encounter.findUniqueOrThrow({ where: { id: encounterId }, include: { clinicAppointment: true, contact: true } });
      if (![EncounterStatus.INTAKE, EncounterStatus.REQUESTED, EncounterStatus.EXPECTED].includes(encounter.status as 'INTAKE' | 'REQUESTED' | 'EXPECTED')) throw new ConflictException('Visit contact can only be corrected before arrival');
      const normalized = email.trim().toLowerCase();
      if (encounter.contact?.email === normalized) return { email: normalized, verifiedAt: encounter.contact.verifiedAt };
      const contact = await tx.encounterContact.update({ where: { encounterId }, data: { email: normalized, verifiedAt: null, version: { increment: 1 } }, select: { email: true, verifiedAt: true } });
      if (encounter.clinicAppointment) await this.notifications.contactChangedTx(tx, encounter.clinicAppointment);
      return contact;
    });
    await this.notifications.notifyChanged((await this.patientEncounter(encounterId, patient)).hospitalId, encounterId);
    return result;
  }

  async patientInterview(encounterId: number, patient: PatientContext, dto?: AdvanceAssessmentDto, start?: StartAssessmentDto) {
    const encounter = await this.patientEncounter(encounterId, patient);
    if (encounter.status !== EncounterStatus.INTAKE) throw new ConflictException('Assessment is not available for this visit');
    const intakeId = this.intakeId(encounter);
    return dto ? this.assessment.advance(intakeId, encounter.patientId, dto, { mode: InterviewAnswerEntryMode.PATIENT_SELF })
      : this.startInterview(intakeId, encounter.patientId, encounter.hospitalId, start);
  }

  /** Read-only, for polling while the next question is prepared. */
  async patientInterviewState(encounterId: number, patient: PatientContext) {
    const encounter = await this.patientEncounter(encounterId, patient);
    if (encounter.status !== EncounterStatus.INTAKE) throw new ConflictException('Assessment is not available for this visit');
    return this.interviewState(this.intakeId(encounter), encounter.patientId, encounter.hospitalId);
  }

  async listReception(staff: Staff) {
    this.assertStaff(staff);
    const entrySettings = await this.entry.settings(staff.hospitalId);
    const encounters = await this.prisma.encounter.findMany({ where: { hospitalId: staff.hospitalId, status: { in: [EncounterStatus.INTAKE, EncounterStatus.ADMITTED] }, intakeSessions: { some: {} } },
      include: { patient: { select: { firstName: true, lastName: true, phone: true, age: true, gender: true } }, contact: { select: { email: true, source: true } }, intakeSessions: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    const intakeIds = encounters.map((encounter) => encounter.intakeSessions[0].id);
    const states = intakeIds.length ? await this.prisma.contextItem.findMany({ where: { intakeSessionId: { in: intakeIds }, itemType: 'ai_interview_state', supersededBy: { none: {} } }, select: { intakeSessionId: true, payload: true } }) : [];
    const clinicQuestions = await this.questionnaire.statusForIntakes(staff.hospitalId, new Map(states.map((state) => [state.intakeSessionId, state.payload])), intakeIds);
    const rows = await Promise.all(encounters.map(async (encounter) => ({
      ...this.toVisit(encounter), patientName: [encounter.patient.firstName, encounter.patient.lastName].filter(Boolean).join(' ') || 'Patient',
      contactEmail: encounter.contact?.email ?? null, contactPhone: encounter.patient.phone ?? null,
      age: encounter.patient.age ?? null, gender: encounter.patient.gender ?? null,
      contactSource: encounter.contact?.source ?? null,
      interviewStatus: await this.assessment.status(encounter.intakeSessions[0].id),
      // Reception sees only whether the clinic's questions were answered, never the answers.
      clinicQuestions: clinicQuestions.get(encounter.intakeSessions[0].id) ?? 'none',
    })));
    await this.audit.record({ resource: SensitiveReadResource.ENCOUNTER_LIST, actorUserId: staff.userId, hospitalId: staff.hospitalId,
      metadata: { workflow: 'CLINIC_APPOINTMENT', view: 'reception_preview', count: rows.length },
    });
    return { acceptsWalkIns: entrySettings.acceptsWalkIns, walkInPath: entrySettings.walkInPath,
      walkIns: rows.filter((row) => row.status === EncounterStatus.ADMITTED && row.contactSource === 'clinic_walk_in'), completedPrevisits: rows.filter((row) => row.status === EncounterStatus.INTAKE && row.interviewStatus === 'complete') };
  }

  async staffInterview(staff: Staff, encounterId: number, dto?: AdvanceAssessmentDto, start?: StartAssessmentDto) {
    const encounter = await this.staffWalkIn(staff, encounterId);
    await this.audit.record({ resource: SensitiveReadResource.ENCOUNTER_DETAIL, actorUserId: staff.userId,
      hospitalId: staff.hospitalId, encounterId, patientId: encounter.patientId,
      metadata: { workflow: 'CLINIC_APPOINTMENT', view: 'staff_assisted_assessment' },
    });
    const intakeId = this.intakeId(encounter);
    return dto ? this.assessment.advance(intakeId, encounter.patientId, dto, { mode: InterviewAnswerEntryMode.STAFF_ASSISTED, userId: staff.userId })
      : this.startInterview(intakeId, encounter.patientId, staff.hospitalId, start);
  }

  /** Read-only polling. The start and each answer are audited; repeated polls aren't. */
  async staffInterviewState(staff: Staff, encounterId: number) {
    const encounter = await this.staffWalkIn(staff, encounterId);
    return this.interviewState(this.intakeId(encounter), encounter.patientId, staff.hospitalId);
  }

  async issueGrant(staff: Staff, encounterId: number) {
    await this.staffWalkIn(staff, encounterId);
    // 64 random bits gives a usable desk code while remaining impractical to
    // guess under the exchange endpoint's rate limit and ten-minute expiry.
    const token = randomBytes(8).toString('base64url');
    const grant = await this.prisma.clinicAssessmentGrant.create({ data: {
      tokenHash: this.hash(token), encounterId, hospitalId: staff.hospitalId, issuedByUserId: staff.userId,
      expiresAt: new Date(Date.now() + DESK_GRANT_TTL_MS),
    } });
    const settings = await this.entry.settings(staff.hospitalId);
    return { grantId: grant.id, token, expiresAt: grant.expiresAt, walkInPath: settings.walkInPath };
  }

  async revokeGrant(staff: Staff, grantId: number) {
    this.assertStaff(staff);
    const grant = await this.prisma.clinicAssessmentGrant.findFirst({ where: { id: grantId, hospitalId: staff.hospitalId } });
    if (!grant) throw new NotFoundException();
    await this.prisma.$transaction(async (tx) => {
      await tx.clinicAssessmentGrant.update({ where: { id: grantId }, data: { revokedAt: new Date() } });
      await tx.clinicAssessmentSession.updateMany({ where: { grantId }, data: { revokedAt: new Date() } });
    });
    return { ok: true };
  }

  async exchangeGrant(token: string, selectedHospitalId?: number) {
    const existing = await this.prisma.clinicAssessmentGrant.findUnique({ where: { tokenHash: this.hash(token) }, select: { hospitalId: true } });
    if (!existing) throw new UnauthorizedException('Desk assessment code expired or already used');
    const hospitalId = selectedHospitalId ? this.pilot.assertTenantEnabled(selectedHospitalId) : this.pilot.assertPreviewEnabled();
    if (existing.hospitalId !== hospitalId) throw new UnauthorizedException('Desk assessment code belongs to another clinic');
    const sessionToken = randomBytes(32).toString('base64url');
    const session = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.clinicAssessmentGrant.updateMany({ where: {
        tokenHash: this.hash(token), hospitalId, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() },
        encounter: { status: EncounterStatus.ADMITTED },
      }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new UnauthorizedException('Desk assessment code expired or already used');
      const grant = await tx.clinicAssessmentGrant.findUniqueOrThrow({ where: { tokenHash: this.hash(token) } });
      return tx.clinicAssessmentSession.create({ data: {
        tokenHash: this.hash(sessionToken), grantId: grant.id, encounterId: grant.encounterId, hospitalId,
        expiresAt: new Date(Date.now() + DESK_SESSION_TTL_MS),
      } });
    });
    return { sessionToken, encounterId: session.encounterId, expiresAt: session.expiresAt };
  }

  async deskInterview(token: string | undefined, dto?: AdvanceAssessmentDto, selectedHospitalId?: number, start?: StartAssessmentDto) {
    const { session, hospitalId } = await this.deskSession(token, selectedHospitalId);
    const intakeId = this.intakeId(session.encounter);
    return dto ? this.assessment.advance(intakeId, session.encounter.patientId, dto, { mode: InterviewAnswerEntryMode.WALKIN_SELF })
      : this.startInterview(intakeId, session.encounter.patientId, hospitalId, start);
  }

  /** Read-only: polling, and checking whether the assessment has started before asking who is answering. */
  async deskInterviewState(token: string | undefined, selectedHospitalId?: number) {
    const { session, hospitalId } = await this.deskSession(token, selectedHospitalId);
    return this.interviewState(this.intakeId(session.encounter), session.encounter.patientId, hospitalId);
  }

  private async deskSession(token: string | undefined, selectedHospitalId?: number) {
    if (!token) throw new UnauthorizedException('Desk assessment session required');
    const session = await this.prisma.clinicAssessmentSession.findUnique({ where: { tokenHash: this.hash(token) },
      include: { grant: true, encounter: { include: { intakeSessions: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
    });
    if (!session) throw new UnauthorizedException('Desk assessment session expired or revoked');
    const hospitalId = selectedHospitalId ? this.pilot.assertTenantEnabled(selectedHospitalId) : this.pilot.assertPreviewEnabled();
    if (session.hospitalId !== hospitalId || session.expiresAt <= new Date() || session.revokedAt || session.grant.revokedAt || session.encounter.status !== EncounterStatus.ADMITTED) {
      throw new UnauthorizedException('Desk assessment session expired or revoked');
    }
    return { session, hospitalId };
  }

  /** Starts or resumes the interview; a new one asks the clinic's published questions after the safety question. */
  private async startInterview(intakeSessionId: number, patientId: number, hospitalId: number, start?: StartAssessmentDto) {
    return this.assessment.start(intakeSessionId, patientId, await this.questionnaire.pinFor(hospitalId), start);
  }

  private async interviewState(intakeSessionId: number, patientId: number, hospitalId: number) {
    return (await this.assessment.state(intakeSessionId, patientId, await this.questionnaire.pinFor(hospitalId))) ?? { status: 'not_started' as const };
  }

  private async patientEncounter(encounterId: number, patient: PatientContext) {
    const encounter = await this.prisma.encounter.findFirst({ where: { id: encounterId, patientId: patient.patientId },
      include: { contact: true, intakeSessions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!encounter) throw new NotFoundException();
    this.pilot.assertTenantEnabled(encounter.hospitalId);
    return encounter;
  }

  private async staffWalkIn(staff: Staff, encounterId: number) {
    this.assertStaff(staff);
    const encounter = await this.prisma.encounter.findFirst({ where: { id: encounterId, hospitalId: staff.hospitalId, status: EncounterStatus.ADMITTED },
      include: { intakeSessions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!encounter || encounter.intakeSessions.length === 0) throw new NotFoundException();
    return encounter;
  }

  private assertStaff(staff: Staff) {
    this.pilot.assertTenantEnabled(staff.hospitalId);
  }

  private intakeId(encounter: { intakeSessions: Array<{ id: number }> }) {
    const id = encounter.intakeSessions[0]?.id;
    if (!id) throw new BadRequestException('Visit has no intake session');
    return id;
  }

  private toVisit(encounter: { id: number; publicId: string; status: EncounterStatus; hospitalId: number; patientId: number; chiefComplaint: string | null; createdAt: Date }) {
    return { id: encounter.id, publicId: encounter.publicId, status: encounter.status, hospitalId: encounter.hospitalId, patientId: encounter.patientId, chiefComplaint: encounter.chiefComplaint, createdAt: encounter.createdAt };
  }

  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
}
