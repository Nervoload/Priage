import { ConflictException, Injectable } from '@nestjs/common';
import { ContextSourceType, InterviewAnswerEntryMode, Prisma, ReviewState, TrustTier, VisibilityScope } from '@prisma/client';
import { randomUUID } from 'crypto';

import { IntakeSessionsService } from '../../intake-sessions/intake-sessions.service';
import { persistAiSummaryTx } from '../../intake/interview/interview-summary.persistence';
import type { ClinicQuestionnairePin } from '../../intake/interview/triage-interview.types';
import { LoggingService } from '../../logging/logging.service';
import { PrismaService } from '../../prisma/prisma.service';
import { readAssessmentConfig, type AssessmentConfig } from '../assessment-config';
import type { CaseSeed } from '../case/case-builder';
import type { AnsweredBy, Case, Language } from '../case/types';
import type { AdvanceAssessmentDto, StartAssessmentDto } from '../dto/assessment.dto';
import { DEFAULT_PACK_ID, packById } from '../packs';
import { advanceAssessment, createAssessment, nextQuestion, type FlowContext, type TurnResult } from './harness-flow';
import { isHarnessPayload, parseHarnessState, toAssessmentClientState } from './harness-state';
import type { AssessmentClientState, HarnessAnswerRecord, HarnessState } from './harness-types';

export interface HarnessStartOptions {
  clinicQuestionnaire?: ClinicQuestionnairePin | null;
  start?: StartAssessmentDto;
}

export interface AnswerAttribution {
  mode: InterviewAnswerEntryMode;
  userId?: number;
}

type Tx = Prisma.TransactionClient;

const toJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function sexOf(gender: string | null): 'female' | 'male' | null {
  const value = gender?.trim().toLowerCase() ?? '';
  if (/^(f|female|woman|femme)$/.test(value)) return 'female';
  if (/^(m|male|man|homme)$/.test(value)) return 'male';
  return null;
}

function languageOf(value: unknown): Language | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'fr' || raw.startsWith('fr-') || raw.startsWith('fran')) return 'fr';
  if (raw === 'en' || raw.startsWith('en-') || raw.startsWith('eng')) return 'en';
  return null;
}

const ANSWERED_BY: readonly AnsweredBy[] = ['self', 'parent', 'caregiver', 'other'];

/**
 * The clinic assessment harness. Each turn runs under interview lock 74001:
 * load the state and case, apply the pure turn logic, and store the answer,
 * case and state in the same transaction. No model call happens in here.
 */
@Injectable()
export class AssessmentHarnessService {
  private readonly config: AssessmentConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly intakeSessions: IntakeSessionsService,
    private readonly logging: LoggingService,
  ) {
    this.config = readAssessmentConfig();
  }

  private flow(): FlowContext {
    return { pack: packById(DEFAULT_PACK_ID), roundSize: this.config.roundSize, now: () => new Date() };
  }

  async start(intakeSessionId: number, patientId: number, options: HarnessStartOptions = {}, correlationId?: string): Promise<AssessmentClientState> {
    return this.withLock(intakeSessionId, async (tx) => {
      const latest = await this.loadState(tx, intakeSessionId);
      if (latest) {
        if (latest.state.status !== 'in_progress' || latest.state.currentQuestion) return toAssessmentClientState(latest.state);
        const current = await this.loadCase(tx, intakeSessionId);
        const next = nextQuestion(latest.state, current.case, this.flow());
        return this.store(tx, intakeSessionId, patientId, { ...next, answer: null, unchanged: false, completed: false }, latest.publicId, current.publicId, undefined, correlationId);
      }
      const seed = await this.loadSeed(tx, intakeSessionId, options.start);
      const created = createAssessment({
        interviewPublicId: `intr_${randomUUID()}`,
        seed,
        clinicQuestionnaire: options.clinicQuestionnaire ?? null,
        packId: DEFAULT_PACK_ID,
        budget: this.config.budget,
        minQuestions: this.config.minQuestions,
        modelQuestions: this.config.modelQuestions,
      }, this.flow());
      return this.store(tx, intakeSessionId, patientId, { ...created, answer: null, caseChanged: true, unchanged: false, completed: false }, null, null, undefined, correlationId);
    });
  }

  async advance(intakeSessionId: number, patientId: number, dto: AdvanceAssessmentDto, attribution?: AnswerAttribution, correlationId?: string): Promise<AssessmentClientState> {
    return this.withLock(intakeSessionId, async (tx) => {
      const latest = await this.loadState(tx, intakeSessionId);
      if (!latest) throw new ConflictException('Start the assessment before answering.');
      const current = await this.loadCase(tx, intakeSessionId);
      const turn = advanceAssessment(latest.state, current.case, dto, this.flow());
      if (turn.unchanged) return toAssessmentClientState(latest.state);
      return this.store(tx, intakeSessionId, patientId, turn, latest.publicId, current.publicId, attribution, correlationId);
    });
  }

  /** The current state without changing anything; the patient app polls this while the next question is prepared. */
  async state(intakeSessionId: number): Promise<AssessmentClientState | null> {
    const latest = await this.loadState(this.prisma, intakeSessionId);
    return latest ? toAssessmentClientState(latest.state) : null;
  }

  async status(intakeSessionId: number): Promise<'not_started' | HarnessState['status']> {
    return (await this.loadState(this.prisma, intakeSessionId))?.state.status ?? 'not_started';
  }

  private withLock<T>(intakeSessionId: number, work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74001, ${intakeSessionId})`;
      return work(tx);
    }, { timeout: 15_000, maxWait: 15_000 });
  }

  private async loadState(db: Tx | PrismaService, intakeSessionId: number): Promise<{ publicId: string; state: HarnessState } | null> {
    const item = await db.contextItem.findFirst({
      where: { intakeSessionId, itemType: 'ai_interview_state', supersededBy: { none: {} } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { publicId: true, payload: true },
    });
    if (!item) return null;
    // The router keeps legacy assessments away from the harness; this is the backstop.
    if (!isHarnessPayload(item.payload)) throw new ConflictException('This assessment was started with the previous engine.');
    const state = parseHarnessState(item.payload);
    if (!state) throw new ConflictException('The stored assessment could not be read.');
    return { publicId: item.publicId, state };
  }

  private async loadCase(tx: Tx, intakeSessionId: number): Promise<{ publicId: string | null; case: Case }> {
    const item = await tx.contextItem.findFirst({
      where: { intakeSessionId, itemType: 'assessment_case', supersededBy: { none: {} } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { publicId: true, payload: true },
    });
    if (!item) throw new ConflictException('The stored assessment has no case.');
    return { publicId: item.publicId, case: item.payload as unknown as Case };
  }

  /** The patient's opening words and who the visit is for, from the start form and profile. */
  private async loadSeed(tx: Tx, intakeSessionId: number, start?: StartAssessmentDto): Promise<CaseSeed> {
    const [session, intake] = await Promise.all([
      tx.intakeSession.findUnique({ where: { id: intakeSessionId }, select: { patient: { select: { age: true, gender: true, preferredLanguage: true } } } }),
      tx.contextItem.findFirst({ where: { intakeSessionId, itemType: 'patient_intake' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { payload: true } }),
    ]);
    const form = asRecord(intake?.payload);
    const subject = asRecord(form.subject);
    const answeredByRaw = start?.answeredBy ?? form.answeredBy;
    const answeredBy: AnsweredBy = ANSWERED_BY.includes(answeredByRaw as AnsweredBy) ? answeredByRaw as AnsweredBy : 'self';
    const forSelf = answeredBy === 'self';
    const subjectAge = start?.subjectAge ?? (typeof subject.age === 'number' ? subject.age : null);
    // Someone answering for another person: never use the account holder's own age or sex for the subject.
    const age = forSelf ? session?.patient?.age ?? null : subjectAge;
    const sex = forSelf ? sexOf(session?.patient?.gender ?? null) : sexOf(text(subject.gender));
    const language = languageOf(start?.language) ?? languageOf(form.language) ?? languageOf(session?.patient?.preferredLanguage) ?? 'en';
    return {
      complaint: text(form.chiefComplaint) ?? '',
      note: text(form.details),
      patient: { age, sex },
      communication: { language, readingLevel: 'standard', answeredBy, subjectAge: forSelf ? null : subjectAge, input: [] },
    };
  }

  private async store(
    tx: Tx, intakeSessionId: number, patientId: number, turn: TurnResult,
    previousStateId: string | null, previousCaseId: string | null, attribution?: AnswerAttribution, correlationId?: string,
  ): Promise<AssessmentClientState> {
    const append = (args: Parameters<IntakeSessionsService['appendContextItemByIntakeSessionIdTx']>[2]) =>
      this.intakeSessions.appendContextItemByIntakeSessionIdTx(tx, intakeSessionId, args);
    const stored = { trustTier: TrustTier.UNTRUSTED, reviewState: ReviewState.UNREVIEWED, visibilityScope: VisibilityScope.STORED_ONLY, patientId };

    if (turn.answer) {
      await append({
        itemType: 'ai_interview_answer', schemaVersion: 'harness-v1', payload: toJson(this.storedAnswer(turn.answer)), ...stored,
        sourceType: attribution?.mode === InterviewAnswerEntryMode.STAFF_ASSISTED ? ContextSourceType.INSTITUTION : ContextSourceType.PATIENT,
        answerEntryMode: attribution?.mode ?? null, enteredByUserId: attribution?.userId ?? null,
      });
    }
    let state = turn.state;
    if (turn.caseChanged || !previousCaseId) {
      await append({ itemType: 'assessment_case', schemaVersion: 'case-v1', payload: toJson(turn.case), sourceType: ContextSourceType.AI, ...stored, supersedesPublicId: previousCaseId ?? undefined });
      state = { ...state, harness: { ...state.harness, caseVersion: turn.case.version, urgency: turn.case.urgency } };
    }
    await append({ itemType: 'ai_interview_state', schemaVersion: 'harness-v1', payload: toJson(state), sourceType: ContextSourceType.AI, ...stored, supersedesPublicId: previousStateId ?? undefined });
    if (turn.completed) await this.writeSummary(tx, intakeSessionId, patientId, state);

    await this.logging.info('Assessment turn stored', { service: 'AssessmentHarnessService', operation: 'store', correlationId, patientId }, {
      intakeSessionId, assessmentStatus: state.status, askedCount: state.askedCount, roundType: state.harness.roundType ?? 'none',
      sourceType: state.currentQuestion?.source ?? 'none', hasAnswer: !!turn.answer,
    });
    return toAssessmentClientState(state);
  }

  /** The answer item Care reads: everything but the plan, which can name possible causes. */
  private storedAnswer(answer: HarnessAnswerRecord): Omit<HarnessAnswerRecord, 'plan'> {
    const { plan: _plan, ...rest } = answer;
    return rest;
  }

  /**
   * The summary downstream readers expect when an assessment completes. No
   * CTAS, no generated text about causes, and no `details` (which would
   * overwrite the patient's own note on the encounter).
   */
  private async writeSummary(tx: Tx, intakeSessionId: number, patientId: number, state: HarnessState): Promise<void> {
    const generatedAt = new Date().toISOString();
    const questionAnswers = state.answers.filter((answer) => answer.questionSource !== 'safety').map((answer) => ({
      question: answer.prompt, answer: answer.answerText, phase: answer.phase, answeredAt: answer.answeredAt,
    }));
    // No urgency here either: clinic urgency comes from Care's rules, not from this summary.
    const common = {
      redFlags: [], recommendedAction: '', summaryPreview: state.summaryPreview,
      briefing: '', recommendedCtasLevel: null, caseSummary: '', questionAnswers, progressionRisks: [],
      generationMode: state.generationMode, governance: state.governance, generatedAt,
    };
    await persistAiSummaryTx(tx, this.intakeSessions, {
      intakeSessionId, patientId,
      item: { ...common, sessionGoal: '', completionReason: state.completionReason, engine: state.harness.engine },
      projection: { ...common, engine: state.harness.engine },
    });
  }
}
