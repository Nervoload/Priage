import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContextSourceType, EncounterStatus, InterviewAnswerEntryMode, Prisma, ReviewState, TrustTier, VisibilityScope } from '@prisma/client';

import type { PatientContext } from '../../auth/guards/patient.guard';
import { IntakeSessionsService } from '../../intake-sessions/intake-sessions.service';
import type { ClinicQuestionnairePin } from '../../intake/interview/triage-interview.types';
import { PrismaService } from '../../prisma/prisma.service';
import { ClinicPilotService } from '../clinic-pilot.service';
import { PublishClinicQuestionnaireDto, SubmitClinicAnswersDto } from '../dto/clinic-questionnaire.dto';
import {
  CLINIC_RESPONSE_ITEM, ClinicQuestionnaireError, DEFAULT_CLINIC_QUESTIONS, LOCKED_CLINIC_QUESTIONS, MAX_CLINIC_QUESTIONS,
  clinicAnswerRecords, clinicQuestionsStatus, parseClinicQuestions, toInterviewQuestions, validateClinicQuestions,
  type ClinicQuestion, type ClinicQuestionsStatus,
} from './clinic-questionnaire';

type Staff = { userId: number; hospitalId: number };
type Database = Prisma.TransactionClient | PrismaService;

const badRequest = (error: unknown): never => {
  if (error instanceof ClinicQuestionnaireError) throw new BadRequestException(error.message);
  throw error;
};

@Injectable()
export class ClinicQuestionnaireService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pilot: ClinicPilotService,
    private readonly intakeSessions: IntakeSessionsService,
  ) {}

  /** The clinic's latest published version, or null when it has none or it asks nothing. */
  async activeVersion(hospitalId: number, db: Database = this.prisma): Promise<{ id: number; version: number; questions: ClinicQuestion[] } | null> {
    const latest = await db.clinicQuestionnaireVersion.findFirst({ where: { hospitalId }, orderBy: { version: 'desc' } });
    if (!latest) return null;
    const questions = parseClinicQuestions(latest.questions);
    return questions.length ? { id: latest.id, version: latest.version, questions } : null;
  }

  /** What a new interview for this clinic should ask after the safety question. */
  async pinFor(hospitalId: number): Promise<ClinicQuestionnairePin | null> {
    const active = await this.activeVersion(hospitalId);
    return active ? { versionId: active.id, version: active.version, questions: toInterviewQuestions(active.questions) } : null;
  }

  async adminView(staff: Staff) {
    this.pilot.assertTenantEnabled(staff.hospitalId);
    const versions = await this.prisma.clinicQuestionnaireVersion.findMany({ where: { hospitalId: staff.hospitalId }, orderBy: { version: 'desc' }, take: 20 });
    const current = versions[0] ?? null;
    const currentQuestions = current ? parseClinicQuestions(current.questions) : null;
    return {
      locked: LOCKED_CLINIC_QUESTIONS,
      defaults: DEFAULT_CLINIC_QUESTIONS,
      maxQuestions: MAX_CLINIC_QUESTIONS,
      current: current ? { version: current.version, questions: currentQuestions ?? [], publishedAt: current.createdAt, publishedByUserId: current.publishedByUserId } : null,
      // A clinic that has never published starts from Priage's defaults.
      draft: currentQuestions ?? DEFAULT_CLINIC_QUESTIONS,
      history: versions.map((item) => ({ version: item.version, questionCount: parseClinicQuestions(item.questions).length, publishedAt: item.createdAt, publishedByUserId: item.publishedByUserId })),
    };
  }

  async publish(staff: Staff, dto: PublishClinicQuestionnaireDto) {
    this.pilot.assertTenantEnabled(staff.hospitalId);
    let questions: ClinicQuestion[] = [];
    try { questions = validateClinicQuestions(dto.questions); } catch (error) { badRequest(error); }
    const stale = new ConflictException('Someone published a newer version. Review it, then publish again.');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(74005, ${staff.hospitalId})`;
        const latest = await tx.clinicQuestionnaireVersion.findFirst({ where: { hospitalId: staff.hospitalId }, orderBy: { version: 'desc' }, select: { version: true } });
        if ((latest?.version ?? 0) !== dto.expectedVersion) throw stale;
        await tx.clinicQuestionnaireVersion.create({ data: { hospitalId: staff.hospitalId, version: dto.expectedVersion + 1, questions: questions as unknown as Prisma.InputJsonValue, publishedByUserId: staff.userId } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw stale;
      throw error;
    }
    return this.adminView(staff);
  }

  /** Status for one intake session, from its current interview state and any separate response. */
  async statusForIntake(hospitalId: number, intakeSessionId: number, db: Database = this.prisma): Promise<{ status: ClinicQuestionsStatus; active: Awaited<ReturnType<ClinicQuestionnaireService['activeVersion']>>; pinned: boolean }> {
    const [state, response, active] = await Promise.all([
      db.contextItem.findFirst({ where: { intakeSessionId, itemType: 'ai_interview_state', supersededBy: { none: {} } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { payload: true } }),
      db.contextItem.findFirst({ where: { intakeSessionId, itemType: CLINIC_RESPONSE_ITEM }, select: { id: true } }),
      this.activeVersion(hospitalId, db),
    ]);
    const pinned = !!(state?.payload && typeof state.payload === 'object' && (state.payload as Record<string, unknown>).clinicQuestionnaire);
    return { status: clinicQuestionsStatus({ interviewState: state?.payload, hasResponse: !!response, activeVersion: active?.version ?? null }), active, pinned };
  }

  /** Status for many intake sessions at once, for lists. */
  async statusForIntakes(hospitalId: number, states: ReadonlyMap<number | null, unknown>, intakeSessionIds: number[]): Promise<Map<number, ClinicQuestionsStatus>> {
    const [responses, active] = await Promise.all([
      intakeSessionIds.length ? this.prisma.contextItem.findMany({ where: { intakeSessionId: { in: intakeSessionIds }, itemType: CLINIC_RESPONSE_ITEM }, select: { intakeSessionId: true } }) : Promise.resolve([]),
      this.activeVersion(hospitalId),
    ]);
    const answered = new Set(responses.map((item) => item.intakeSessionId));
    return new Map(intakeSessionIds.map((id) => [id, clinicQuestionsStatus({ interviewState: states.get(id), hasResponse: answered.has(id), activeVersion: active?.version ?? null })]));
  }

  /**
   * For patients who finished the general assessment before choosing this
   * clinic: the questions they still need to answer before booking.
   */
  async patientQuestions(encounterId: number, patient: PatientContext) {
    const { encounter, intakeSessionId } = await this.patientVisit(encounterId, patient);
    const { status, active, pinned } = await this.statusForIntake(encounter.hospitalId, intakeSessionId);
    const ask = status === 'pending' && !pinned && !!active;
    return { status, version: ask ? active.version : null, questions: ask ? active.questions.map(({ key, prompt, helpText, inputType, choices }) => ({ key, prompt, helpText, inputType, choices })) : [] };
  }

  async submitPatientAnswers(encounterId: number, patient: PatientContext, dto: SubmitClinicAnswersDto) {
    const { encounter, intakeSessionId } = await this.patientVisit(encounterId, patient);
    if (encounter.status !== EncounterStatus.INTAKE) throw new ConflictException('These questions can only be answered before booking');
    const { status, active, pinned } = await this.statusForIntake(encounter.hospitalId, intakeSessionId);
    if (status === 'answered') return this.patientQuestions(encounterId, patient);
    if (pinned) throw new ConflictException('These questions are part of your assessment');
    if (!active) return this.patientQuestions(encounterId, patient);
    if (dto.version !== active.version) throw new ConflictException('The clinic changed its questions. Review them, then send your answers again.');
    let answers: ReturnType<typeof clinicAnswerRecords> = [];
    try { answers = clinicAnswerRecords(active.questions, dto.answers, new Date()); } catch (error) { badRequest(error); }
    await this.intakeSessions.appendContextItemsByIntakeSessionId(intakeSessionId, [{
      itemType: CLINIC_RESPONSE_ITEM,
      schemaVersion: 'v1',
      payload: { versionId: active.id, version: active.version, questions: toInterviewQuestions(active.questions), answers, timing: 'after_interview' } as unknown as Prisma.InputJsonValue,
      sourceType: ContextSourceType.PATIENT,
      trustTier: TrustTier.UNTRUSTED,
      reviewState: ReviewState.UNREVIEWED,
      visibilityScope: VisibilityScope.STORED_ONLY,
      patientId: patient.patientId,
      answerEntryMode: InterviewAnswerEntryMode.PATIENT_SELF,
    }]);
    return this.patientQuestions(encounterId, patient);
  }

  private async patientVisit(encounterId: number, patient: PatientContext) {
    const encounter = await this.prisma.encounter.findFirst({ where: { id: encounterId, patientId: patient.patientId },
      select: { id: true, status: true, hospitalId: true, intakeSessions: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } } });
    if (!encounter) throw new NotFoundException();
    this.pilot.assertTenantEnabled(encounter.hospitalId);
    const intakeSessionId = encounter.intakeSessions[0]?.id;
    if (!intakeSessionId) throw new BadRequestException('Visit has no intake session');
    return { encounter, intakeSessionId };
  }
}
