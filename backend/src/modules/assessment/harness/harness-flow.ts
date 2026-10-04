import { BadRequestException } from '@nestjs/common';

import type { ClinicQuestionnairePin } from '../../intake/interview/triage-interview.types';
import { SAFETY_GATE_PUBLIC_ID } from '../../intake/interview/triage-interview.types';
import { AnswerError, normalizeAnswer, sameAnswer, type AnswerInput, type NormalizedAnswer } from '../case/answers';
import { applyRound, initialCase, type CaseSeed } from '../case/case-builder';
import { deterministicRound } from '../case/deterministic-planner';
import { answerSignals, recordAnswer } from '../case/evidence';
import { checkQuestion } from '../case/question-checks';
import { chooseRoundType, stopRule, type StopContext, type StopReason } from '../case/stop-rule';
import type { Case, PlannedQuestion } from '../case/types';
import type { AssessmentMode } from '../assessment-config';
import { bankById, bankToPlanned } from '../packs';
import { audienceFor } from '../packs/fixed-wording';
import type { KnowledgePack } from '../packs/types';
import { checkEmergency, emergencyAlert } from './emergency-rules';
import { harnessGovernance, patientSummary, toClientQuestion } from './harness-state';
import { HARNESS_ENGINE, type HarnessAnswerRecord, type HarnessQuestion, type HarnessState } from './harness-types';
import { clinicQuestion, followUpQuestion, materialize, planOf, safetyQuestion, specOf, type MaterializeContext } from './question-materializer';

// The harness's turn logic as pure functions over (state, case). The service
// loads them under the interview lock, calls one of these, and stores the
// result. No I/O and no model calls happen here.

export type HarnessAction = 'acknowledge_emergency' | 'confirm_review' | 'correct_answer';

export interface HarnessAdvance extends AnswerInput {
  questionPublicId?: string;
  action?: HarnessAction;
}

export interface FlowContext {
  pack: KnowledgePack;
  roundSize: number;
  now: () => Date;
}

export interface TurnResult {
  state: HarnessState;
  case: Case;
  answer: HarnessAnswerRecord | null;
  caseChanged: boolean;
  /** Nothing to store: an identical retry, or an action that's already done. */
  unchanged: boolean;
  /** The patient confirmed their answers; the summary and handoff can be written. */
  completed: boolean;
}

export interface CreateOptions {
  interviewPublicId: string;
  seed: CaseSeed;
  clinicQuestionnaire: ClinicQuestionnairePin | null;
  packId: string;
  budget: number;
  minQuestions: number;
  modelQuestions: AssessmentMode;
}

const MISMATCH = 'Interview answer does not match the active question.';

function materializeContext(state: HarnessState, ctx: FlowContext): MaterializeContext {
  return { pack: ctx.pack, language: state.harness.communication.language, audience: audienceFor(state.harness.communication.answeredBy) };
}

function stopContext(state: HarnessState, ctx: FlowContext): StopContext {
  return { coreHistory: ctx.pack.coreHistory, askedCount: state.askedCount, budget: state.harness.budget, minQuestions: state.harness.minQuestions };
}

export function createAssessment(options: CreateOptions, ctx: FlowContext): { state: HarnessState; case: Case } {
  const current = initialCase(options.seed, ctx.pack);
  const { communication } = options.seed;
  const state: HarnessState = {
    interviewPublicId: options.interviewPublicId,
    status: 'in_progress',
    phase: 'urgent',
    askedCount: 0,
    maxQuestions: options.budget,
    currentQuestion: safetyQuestion(communication.language, audienceFor(communication.answeredBy)),
    cachedQuestions: [],
    pendingCandidates: [],
    emergencyAlert: null,
    summaryPreview: '',
    answers: [],
    emergencyAcknowledged: false,
    summaryRecord: null,
    sessionGoal: '',
    targetQuestionCount: null,
    completionReason: '',
    providerState: null,
    generationMode: 'fallback',
    governance: harnessGovernance('fallback', { name: 'deterministic', model: null, promptVersion: ctx.pack.version }),
    clinicQuestionnaire: options.clinicQuestionnaire,
    harness: {
      engine: HARNESS_ENGINE,
      packId: options.packId,
      communication,
      modelQuestions: options.modelQuestions,
      budget: options.budget,
      minQuestions: options.minQuestions,
      round: 0,
      roundType: null,
      queue: [],
      planning: null,
      caseVersion: current.version,
      urgency: current.urgency,
      stopReason: null,
      followUps: 0,
    },
  };
  return { state, case: current };
}

function serve(state: HarnessState, question: HarnessQuestion, queue: PlannedQuestion[]): HarnessState {
  return { ...state, status: 'in_progress', phase: question.phase, currentQuestion: question, emergencyAlert: null, harness: { ...state.harness, queue } };
}

function toReview(state: HarnessState, current: Case, reason: StopReason): { state: HarnessState; case: Case } {
  const leftover = state.harness.queue.map((question) => ({ question, reason }));
  return {
    state: {
      ...state,
      status: 'review',
      currentQuestion: null,
      summaryPreview: patientSummary('review', state.harness.communication.language),
      completionReason: reason,
      harness: { ...state.harness, queue: [], stopReason: reason },
    },
    case: leftover.length ? { ...current, notChosen: [...current.notChosen, ...leftover] } : current,
  };
}

/** A queued question can go stale: an answer meanwhile may have settled what it asks. */
function stillUseful(plan: PlannedQuestion, current: Case): boolean {
  return !checkQuestion(plan, { current, causeTerms: [], allowLongText: true }).includes('repeat');
}

/** The closing "anything else?" if it hasn't been asked and there's room. */
function closingQuestion(state: HarnessState, current: Case, ctx: FlowContext): PlannedQuestion | null {
  const bank = bankById(ctx.pack, ctx.pack.order.closing);
  if (!bank || state.askedCount >= state.harness.budget || current.asked.some((asked) => asked.key === bank.id)) return null;
  return bankToPlanned(bank);
}

/**
 * Serves the next question: the safety question, then the clinic's questions,
 * then the queued round, then a new round from the bank. Stops for review when
 * the budget is spent or the case is done.
 */
export function nextQuestion(state: HarnessState, current: Case, ctx: FlowContext): { state: HarnessState; case: Case; caseChanged: boolean } {
  const answered = new Set(state.answers.map((answer) => answer.questionPublicId));
  const { language, answeredBy } = state.harness.communication;
  const mctx = materializeContext(state, ctx);
  if (!answered.has(SAFETY_GATE_PUBLIC_ID)) return { state: serve(state, safetyQuestion(language, audienceFor(answeredBy)), state.harness.queue), case: current, caseChanged: false };
  const clinic = state.clinicQuestionnaire?.questions.find((question) => !answered.has(question.publicId));
  if (clinic) return { state: serve(state, clinicQuestion(clinic, language), state.harness.queue), case: current, caseChanged: false };
  if (state.askedCount >= state.harness.budget) return { ...toReview(state, current, 'budget'), caseChanged: true };

  let working = current;
  const queue = [...state.harness.queue];
  while (queue.length) {
    const plan = queue.shift() as PlannedQuestion;
    if (stillUseful(plan, working)) return { state: serve(state, materialize(plan, mctx), queue), case: working, caseChanged: working !== current };
    working = { ...working, notChosen: [...working.notChosen, { question: plan, reason: 'superseded' }] };
  }

  // A new round from the bank. (Model planning replaces this step when a driver is configured.)
  const built = applyRound(working, ctx.pack, null).case;
  const withQueue = { ...state, harness: { ...state.harness, queue: [], caseVersion: built.version } };
  const stopCtx = stopContext(withQueue, ctx);
  const roundType = chooseRoundType(built, stopCtx);
  const round = roundType === 'stop' ? [] : deterministicRound(built, ctx.pack, { roundSize: ctx.roundSize, remainingBudget: stopCtx.budget - stopCtx.askedCount });
  if (!round.length) {
    const reason = stopRule(built, stopCtx) ?? 'case_done';
    const closing = reason === 'case_done' ? closingQuestion(withQueue, built, ctx) : null;
    if (closing) return { state: serve(withQueue, materialize(closing, mctx), []), case: built, caseChanged: true };
    return { ...toReview(withQueue, built, reason), caseChanged: true };
  }
  const next: HarnessState = { ...withQueue, harness: { ...withQueue.harness, round: withQueue.harness.round + 1, roundType: roundType === 'stop' ? null : roundType } };
  return { state: serve(next, materialize(round[0], mctx), round.slice(1)), case: built, caseChanged: true };
}

function normalizeOrThrow(spec: HarnessAnswerRecord['spec'], input: AnswerInput, language: HarnessQuestion['language']): NormalizedAnswer {
  try {
    return normalizeAnswer(spec, input, language);
  } catch (error) {
    if (error instanceof AnswerError) throw new BadRequestException(error.message);
    throw error;
  }
}

function answerInput(dto: HarnessAdvance): AnswerInput {
  const { valueText, valueNumber, valueBoolean, valueChoice, valueChoices, valueDuration, notSure } = dto;
  return { valueText, valueNumber, valueBoolean, valueChoice, valueChoices, valueDuration, notSure };
}

function buildRecord(question: HarnessQuestion, answer: NormalizedAnswer, state: HarnessState, answerId: string, at: Date, correctionOf?: string): HarnessAnswerRecord {
  return {
    questionPublicId: question.publicId,
    phase: question.phase,
    // English, so Care's rules and the model read one language.
    prompt: question.englishPrompt,
    inputType: question.inputType,
    answeredAt: at.toISOString(),
    answerText: answer.answerText,
    ...(answer.valueText !== undefined ? { valueText: answer.valueText } : {}),
    ...(answer.valueNumber !== undefined ? { valueNumber: answer.valueNumber } : {}),
    ...(answer.valueBoolean !== undefined ? { valueBoolean: answer.valueBoolean } : {}),
    ...(answer.valueChoice !== undefined ? { valueChoice: answer.valueChoice } : {}),
    ...(answer.valueChoices !== undefined ? { valueChoices: answer.valueChoices } : {}),
    ...(answer.valueDuration !== undefined ? { valueDuration: answer.valueDuration } : {}),
    answerId,
    ...(correctionOf ? { correctionOf } : {}),
    originalText: answer.originalText,
    displayPrompt: question.prompt,
    language: question.language,
    machineTranslated: question.machineTranslated,
    notSure: answer.notSure,
    answeredBy: state.harness.communication.answeredBy,
    questionSource: question.source,
    ...(question.element ? { element: question.element } : {}),
    ...(question.bankKey ? { bankKey: question.bankKey } : {}),
    spec: specOf(question),
    question: toClientQuestion(question),
    ...(question.plan ? { plan: question.plan } : {}),
  };
}

const asNormalized = (record: HarnessAnswerRecord): NormalizedAnswer => ({ answerText: record.answerText, originalText: record.originalText, notSure: record.notSure });

function emergency(state: HarnessState, reason: string, triggerQuestionId: string): HarnessState {
  return {
    ...state,
    status: 'emergency_ack_required',
    currentQuestion: null,
    emergencyAlert: emergencyAlert(state.harness.communication.language, reason, triggerQuestionId),
    summaryPreview: 'Emergency warning shown. Awaiting patient acknowledgment before continuing.',
  };
}

const unchanged = (state: HarnessState, current: Case): TurnResult => ({ state, case: current, answer: null, caseChanged: false, unchanged: true, completed: false });

/** An identical resubmission of the last answer is a retry, not a new answer. */
function isRetry(state: HarnessState, dto: HarnessAdvance): boolean {
  const last = state.answers.at(-1);
  if (!last || dto.questionPublicId !== last.questionPublicId) return false;
  try {
    return sameAnswer(normalizeAnswer(last.spec, answerInput(dto), last.language), asNormalized(last));
  } catch {
    return false;
  }
}

function correct(state: HarnessState, current: Case, dto: HarnessAdvance, ctx: FlowContext): TurnResult {
  const questionPublicId = dto.questionPublicId;
  if (!questionPublicId) throw new BadRequestException('Choose the answer to change.');
  if (questionPublicId === SAFETY_GATE_PUBLIC_ID) throw new BadRequestException('The safety question can’t be changed here.');
  const latest = [...state.answers].reverse().find((answer) => answer.questionPublicId === questionPublicId);
  if (!latest) throw new BadRequestException('Choose the answer to change.');
  const normalized = normalizeOrThrow(latest.spec, answerInput(dto), latest.language);
  if (sameAnswer(normalized, asNormalized(latest))) return unchanged(state, current);

  const n = state.answers.filter((answer) => answer.questionPublicId === questionPublicId && answer.correctionOf).length + 1;
  const question: HarnessQuestion = { ...latest.question, englishPrompt: latest.prompt, choiceKeys: latest.spec.choiceKeys, ...(latest.plan ? { plan: latest.plan } : {}) };
  const record = buildRecord(question, normalized, state, `${questionPublicId}:correction:${n}`, ctx.now(), latest.answerId);
  const nextCase = recordAnswer(current, planOf(question), normalized, { answerId: record.answerId, language: record.language, answeredBy: record.answeredBy });
  const withAnswer: HarnessState = { ...state, answers: [...state.answers, record] };
  const check = checkEmergency(question, normalized);
  return {
    state: check.emergency ? emergency(withAnswer, check.reason, questionPublicId) : withAnswer,
    case: nextCase, answer: record, caseChanged: true, unchanged: false, completed: false,
  };
}

export function advanceAssessment(state: HarnessState, current: Case, dto: HarnessAdvance, ctx: FlowContext): TurnResult {
  switch (state.status) {
    case 'complete':
      if (dto.questionPublicId) throw new BadRequestException(MISMATCH);
      return unchanged(state, current);

    case 'emergency_ack_required': {
      if (dto.action !== 'acknowledge_emergency') throw new BadRequestException('Emergency acknowledgment is required before continuing.');
      const acknowledged: HarnessState = { ...state, status: 'in_progress', emergencyAcknowledged: true, emergencyAlert: null };
      // A warning raised while correcting answers goes back to the review.
      if (state.harness.stopReason) return { ...toReviewTurn(acknowledged, current, state.harness.stopReason), unchanged: false };
      const next = nextQuestion(acknowledged, current, ctx);
      return { ...next, answer: null, unchanged: false, completed: false };
    }

    case 'review':
      if (dto.action === 'confirm_review') {
        return {
          state: { ...state, status: 'complete', summaryPreview: patientSummary('complete', state.harness.communication.language) },
          case: current, answer: null, caseChanged: false, unchanged: false, completed: true,
        };
      }
      if (dto.action === 'correct_answer') return correct(state, current, dto, ctx);
      if (dto.action === 'acknowledge_emergency' || isRetry(state, dto)) return unchanged(state, current);
      throw new BadRequestException('Your answers are ready to check. Change one or send them to the clinic.');

    case 'in_progress':
    default:
      return answerActive(state, current, dto, ctx);
  }
}

function toReviewTurn(state: HarnessState, current: Case, reason: StopReason): TurnResult {
  const review = toReview(state, current, reason);
  return { ...review, answer: null, caseChanged: review.case !== current, unchanged: false, completed: false };
}

function answerActive(state: HarnessState, current: Case, dto: HarnessAdvance, ctx: FlowContext): TurnResult {
  if (dto.action === 'acknowledge_emergency') return unchanged(state, current);
  if (dto.action) throw new BadRequestException('Your answers aren’t ready to check yet.');

  const active = state.currentQuestion;
  if (!active) {
    if (dto.questionPublicId) {
      if (isRetry(state, dto)) return unchanged(state, current);
      throw new BadRequestException(MISMATCH);
    }
    const next = nextQuestion(state, current, ctx);
    return { ...next, answer: null, unchanged: false, completed: false };
  }
  if (dto.questionPublicId !== active.publicId) {
    if (isRetry(state, dto)) return unchanged(state, current);
    throw new BadRequestException(MISMATCH);
  }

  const normalized = normalizeOrThrow(specOf(active), answerInput(dto), active.language);
  const record = buildRecord(active, normalized, state, active.publicId, ctx.now());
  const counts = active.source !== 'safety' && active.source !== 'clinic';
  const answered: HarnessState = {
    ...state,
    askedCount: state.askedCount + (counts ? 1 : 0),
    answers: [...state.answers, record],
    currentQuestion: null,
    emergencyAlert: null,
  };
  const plan = planOf(active);
  let nextCase = recordAnswer(current, plan, normalized, { answerId: record.answerId, language: record.language, answeredBy: record.answeredBy });

  const check = checkEmergency(active, normalized);
  if (check.emergency) {
    return { state: emergency(answered, check.reason, active.publicId), case: nextCase, answer: record, caseChanged: true, unchanged: false, completed: false };
  }

  // One gentle follow-up for a vague free-text answer.
  const vague = nextCase.evidence.at(-1)?.kind === 'vague';
  const followable = active.source === 'bank' || active.source === 'model' || active.source === 'fallback';
  if (vague && followable && !nextCase.followedUp.includes(record.answerId) && answered.askedCount < answered.harness.budget) {
    const n = answered.harness.followUps + 1;
    nextCase = { ...nextCase, followedUp: [...nextCase.followedUp, record.answerId] };
    const followUp = followUpQuestion(record, active.plan, n, materializeContext(answered, ctx));
    const withFollowUp: HarnessState = { ...answered, harness: { ...answered.harness, followUps: n } };
    return { state: serve(withFollowUp, followUp, withFollowUp.harness.queue), case: nextCase, answer: record, caseChanged: true, unchanged: false, completed: false };
  }

  // An answer that supports a dangerous cause ends the round, so the next one is planned around it.
  let afterSignals = answered;
  const signals = answerSignals(plan, normalized, nextCase);
  if (signals.supportsCantMiss.length && answered.harness.queue.length) {
    nextCase = { ...nextCase, notChosen: [...nextCase.notChosen, ...answered.harness.queue.map((question) => ({ question, reason: 'round_ended_early' }))] };
    afterSignals = { ...answered, harness: { ...answered.harness, queue: [] } };
  }

  const next = nextQuestion(afterSignals, nextCase, ctx);
  return { state: next.state, case: next.case, answer: record, caseChanged: true, unchanged: false, completed: false };
}
