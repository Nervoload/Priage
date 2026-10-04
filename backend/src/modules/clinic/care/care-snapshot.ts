import { isHarnessPayload } from '../../assessment/harness/harness-state';
import { rescueBankKeyFor, type RescueBankKey } from '../../intake/interview/rescue-question-bank';
import { SAFETY_GATE_PUBLIC_ID } from '../../intake/interview/triage-interview.types';
import {
  buildClinicHandoff, CLINIC_HANDOFF_RULES_VERSION,
  type AnswerSource, type AskItem, type Gap, type NextStep, type Reason, type RedFlag, type ScreenRow, type UrgencyLevel,
} from './clinic-handoff.rules';
import { deriveEmergencyEvents, type EmergencyEvent, type InterviewStateRow } from './emergency-events';

type JsonRecord = Record<string, unknown>;
const asRecord = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const promptKey = (value: string): string => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-CA');

export type CareSegmentVoice = 'patient' | 'generated' | 'clinic' | 'record';
export type CareSectionKey =
  | 'summary' | 'urgency' | 'red_flags' | 'emergency' | 'next_steps' | 'ask_in_room' | 'gaps'
  | 'transcript' | 'not_asked' | 'questionnaire' | 'visit_record' | 'considerations' | 'exam' | 'timed_risks';

export interface CareSegment {
  id: string;
  kind: string;
  text: string;
  /** v2 only. Who the words belong to; drives the "three voices" styling and feedback. */
  voice?: CareSegmentVoice;
  section?: CareSectionKey;
  ruleId?: string;
}

export interface CareSnapshotAnswerV1 { questionId: string; question: string; answer: string; phase: string; answeredAt: string; entryMode: string | null; enteredByUserId: number | null }
export interface CareSnapshotUnaskedV1 { questionId: string; question: string; phase: string; clinicalReason: string | null }

export interface CareSnapshotContentV1 {
  interviewStatus: string;
  generatedAt: string | null;
  generationMode: 'ai' | 'fallback';
  provider: JsonRecord | null;
  governanceVersion: string | null;
  summary: { briefing: string; caseSummary: string; recommendedAction: string; redFlags: string[]; progressionRisks: string[] };
  answers: CareSnapshotAnswerV1[];
  unasked: CareSnapshotUnaskedV1[];
  segments: CareSegment[];
}

export type CareStage = 'red_flag_screen' | 'narrowing' | 'history';

export interface CareSnapshotContentV2 extends CareSnapshotContentV1 {
  schemaVersion: 2;
  governance: { version: string | null; decisionSupportOnly: true; humanReviewRequired: true };
  handoffGenerator: { kind: 'deterministic' | 'model'; rulesVersion: string; promptVersion: string | null; model: string | null };
  visitRecord: { chiefComplaint: string; patientNote: string | null; allergies: string | null; conditions: string | null };
  urgency: { level: UrgencyLevel; sentence: string; reasons: Reason[] };
  emergencyEvents: EmergencyEvent[];
  /** Filled once clinics publish a questionnaire. */
  /** The clinic's own questions: asked in the interview after the safety question, or afterwards for general-site patients. */
  questionnaire: null | { versionId: number; version: number; timing: 'in_interview' | 'after_interview'; submittedAt: string | null; fedToInterview: boolean };
  answers: Array<CareSnapshotAnswerV1 & { source: AnswerSource; stage: CareStage | null; why: string | null; inputType: string } & HarnessAnswerFields>;
  unasked: Array<CareSnapshotUnaskedV1 & { stage: CareStage | null }>;
  redFlags: RedFlag[];
  redFlagScreen: ScreenRow[];
  nextSteps: NextStep[];
  askInRoom: AskItem[];
  gaps: Gap[];
  /** Hidden until a clinical owner approves timed risks, or a model pass fills them. */
  timedRisks: Array<{ id: string; text: string; window: string | null; refs: string[] }>;
  /** Model-pass only; empty in deterministic mode. */
  considerations: Array<{ id: string; text: string; supporting: string[]; against: string[] }>;
  /** Model-pass only; empty in deterministic mode. */
  examSuggestions: Array<{ id: string; text: string; why: string; refs: string[] }>;
}

/** Extra answer fields the assessment harness records. Absent for legacy interviews. */
export interface HarnessAnswerFields {
  /** What the patient chose or wrote, in their language, when it differs from the English answer. */
  originalText?: string;
  language?: string;
  machineTranslated?: boolean;
  answeredBy?: string;
  /** The answer id this one corrects, from the confirm-your-answers screen. */
  correctionOf?: string;
}

export type CareSnapshotContent = CareSnapshotContentV1 | CareSnapshotContentV2;

export function isSnapshotV2(content: unknown): content is CareSnapshotContentV2 {
  return asRecord(content).schemaVersion === 2;
}

export interface SnapshotBuildInput {
  /** Every ai_interview_state row for the intake session, any order. */
  states: InterviewStateRow[];
  /** ai_interview_answer rows in answer order. */
  answerItems: Array<{ payload: unknown; answerEntryMode: string | null; enteredByUserId: number | null }>;
  /** The active AI_DERIVED summary projection, if the interview finished. */
  projection: { content: unknown; createdAt: Date } | null;
  /** The patient's own start-form words (latest patient_intake item). */
  patientIntake: { chiefComplaint: string | null; details: string | null } | null;
  encounterComplaint: string | null;
  patient: { age: number | null; gender: string | null; allergies: string | null; conditions: string | null };
  complete: boolean;
  /** Answers to the clinic's questions given after the interview, by general-site patients. */
  clinicResponse?: { payload: unknown; createdAt: Date } | null;
  /** True when the clinic has published questions this visit should have answered. */
  clinicQuestionsExpected?: boolean;
}

const STAGES: Record<string, CareStage> = { urgent: 'red_flag_screen', emergent: 'narrowing', history: 'history' };

type MappedAnswer = CareSnapshotContentV2['answers'][number] & { valueBoolean?: boolean; valueNumber?: number; notSure?: boolean; bankKey?: RescueBankKey };

function answerFromRecord(payload: unknown, entryMode: string | null, enteredByUserId: number | null, candidates: ReadonlyMap<string, CareSnapshotUnaskedV1>): MappedAnswer {
  const value = asRecord(payload);
  const questionPublicId = text(value.questionPublicId);
  // Harness answers carry their own id, so a corrected answer never shares a segment with the original.
  const questionId = text(value.answerId) || questionPublicId;
  const source: AnswerSource = questionPublicId === SAFETY_GATE_PUBLIC_ID ? 'safety' : questionPublicId.startsWith('clinic:') ? 'clinic' : 'ai';
  const phase = text(value.phase);
  const answer = text(value.answerText);
  const originalText = text(value.originalText);
  return {
    questionId, question: text(value.prompt), answer, phase, answeredAt: text(value.answeredAt),
    entryMode, enteredByUserId,
    source, stage: source === 'ai' ? STAGES[phase] ?? null : null, why: source === 'clinic' ? null : candidates.get(questionPublicId)?.clinicalReason ?? null,
    inputType: text(value.inputType),
    valueBoolean: typeof value.valueBoolean === 'boolean' ? value.valueBoolean : undefined,
    valueNumber: typeof value.valueNumber === 'number' ? value.valueNumber : undefined,
    ...(value.notSure === true ? { notSure: true } : {}),
    ...(typeof value.bankKey === 'string' ? { bankKey: value.bankKey as RescueBankKey } : {}),
    ...(originalText && originalText !== answer ? { originalText } : {}),
    ...(typeof value.language === 'string' ? { language: value.language } : {}),
    ...(value.machineTranslated === true ? { machineTranslated: true } : {}),
    ...(typeof value.answeredBy === 'string' && value.answeredBy !== 'self' ? { answeredBy: value.answeredBy } : {}),
    ...(typeof value.correctionOf === 'string' ? { correctionOf: value.correctionOf } : {}),
  };
}

/** Harness formats as the input types clinic-handoff-rules@1 already understands, so the rules don't change. */
const RULE_INPUT_TYPE: Record<string, string> = { scale: 'number', multi_select: 'text', duration: 'text' };

function toHandoffAnswer(answer: MappedAnswer) {
  return {
    questionId: answer.questionId, prompt: answer.question, answerText: answer.answer, inputType: RULE_INPUT_TYPE[answer.inputType] ?? answer.inputType, phase: answer.phase,
    // "Not sure" is never a No.
    answeredAt: answer.answeredAt, valueBoolean: answer.notSure ? undefined : answer.valueBoolean, valueNumber: answer.valueNumber, source: answer.source,
    bankKey: answer.bankKey ?? rescueBankKeyFor(answer.question),
  };
}

/**
 * What the Care queue shows per row, from the current interview state alone
 * (its answers list), so the queue needs no snapshot.
 */
export function queueHandoffSummary(input: {
  state: unknown;
  patientIntake: SnapshotBuildInput['patientIntake'];
  encounterComplaint: string | null;
  patient: SnapshotBuildInput['patient'];
}): { briefing: string; urgency: { level: UrgencyLevel; sentence: string }; redFlagCount: number } | null {
  const state = asRecord(input.state);
  if (!text(state.status)) return null;
  const answers = (Array.isArray(state.answers) ? state.answers : [])
    .map((record) => answerFromRecord(record, null, null, new Map()))
    .filter((answer) => answer.questionId && answer.question);
  const handoff = buildClinicHandoff({
    complaint: input.patientIntake?.chiefComplaint?.trim() || input.encounterComplaint?.trim() || 'No reason recorded',
    patientNote: input.patientIntake?.details?.trim() || null,
    age: input.patient.age,
    gender: input.patient.gender,
    allergies: input.patient.allergies,
    conditions: input.patient.conditions,
    answers: answers.map(toHandoffAnswer),
    unasked: [],
    interview: {
      askedCount: typeof state.askedCount === 'number' ? state.askedCount : 0,
      maxQuestions: typeof state.maxQuestions === 'number' ? state.maxQuestions : 12,
    },
    emergencyEvents: [],
    partial: text(state.status) !== 'complete',
    modelCaseSummary: null,
  });
  return { briefing: handoff.briefing, urgency: { level: handoff.urgency.level, sentence: handoff.urgency.sentence }, redFlagCount: handoff.redFlags.length };
}

export function buildCareSnapshotContentV2(input: SnapshotBuildInput): CareSnapshotContentV2 {
  const ordered = [...input.states].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const current = asRecord(ordered[ordered.length - 1]?.payload);

  // Every question the engine ever planned, with its clinical reason.
  const candidates = new Map<string, CareSnapshotUnaskedV1>();
  for (const row of ordered) {
    const payload = asRecord(row.payload);
    for (const raw of [payload.currentQuestion, ...(Array.isArray(payload.cachedQuestions) ? payload.cachedQuestions : []), ...(Array.isArray(payload.pendingCandidates) ? payload.pendingCandidates : [])]) {
      const candidate = asRecord(raw);
      const questionId = text(candidate.publicId);
      if (questionId && text(candidate.prompt) && !candidates.has(questionId)) {
        candidates.set(questionId, { questionId, question: text(candidate.prompt), phase: text(candidate.phase), clinicalReason: text(candidate.clinicalReason) || null });
      }
    }
  }

  const interviewAnswers = input.answerItems
    .map((item) => answerFromRecord(item.payload, item.answerEntryMode, item.enteredByUserId, candidates))
    .filter((answer) => answer.questionId && answer.question);
  // Clinic answers given after the interview go after the safety answer, where the interview would have asked them.
  const response = asRecord(input.clinicResponse?.payload);
  const responseAnswers = (Array.isArray(response.answers) ? response.answers : [])
    .map((record) => answerFromRecord(record, 'PATIENT_SELF', null, candidates))
    .filter((answer) => answer.source === 'clinic' && answer.question);
  const answers = [...interviewAnswers.filter((answer) => answer.source === 'safety'), ...responseAnswers, ...interviewAnswers.filter((answer) => answer.source !== 'safety')];

  // The clinic's own questions: pinned in the interview, or answered separately afterwards.
  const pin = asRecord(current.clinicQuestionnaire);
  const pinnedIds = (Array.isArray(pin.questions) ? pin.questions : []).map((question) => text(asRecord(question).publicId)).filter(Boolean);
  const clinicAnswers = answers.filter((answer) => answer.source === 'clinic');
  const questionnaire: CareSnapshotContentV2['questionnaire'] = pinnedIds.length && typeof pin.versionId === 'number'
    ? { versionId: pin.versionId, version: typeof pin.version === 'number' ? pin.version : 0, timing: 'in_interview', submittedAt: clinicAnswers[clinicAnswers.length - 1]?.answeredAt ?? null, fedToInterview: true }
    : typeof response.versionId === 'number' && input.clinicResponse
      ? { versionId: response.versionId, version: typeof response.version === 'number' ? response.version : 0, timing: 'after_interview', submittedAt: input.clinicResponse.createdAt.toISOString(), fedToInterview: false }
      : null;
  const clinicAnswered = pinnedIds.length ? pinnedIds.every((id) => clinicAnswers.some((answer) => answer.questionId === id)) : !!questionnaire;

  // The engine can give a regenerated prompt a new id; an answered prompt is never "not asked".
  const answeredIds = new Set(answers.map((answer) => answer.questionId));
  const answeredPrompts = new Set(answers.map((answer) => promptKey(answer.question)));
  const seenUnasked = new Set<string>();
  const unasked = [...candidates.values()].filter((candidate) => {
    const key = promptKey(candidate.question);
    // Unanswered clinic questions show as a gap, not as generated questions.
    if (candidate.questionId.startsWith('clinic:') || answeredIds.has(candidate.questionId) || answeredPrompts.has(key) || seenUnasked.has(key)) return false;
    seenUnasked.add(key);
    return true;
  }).map((candidate) => ({ ...candidate, stage: STAGES[candidate.phase] ?? null }));

  const emergencyEvents = deriveEmergencyEvents(ordered);
  const projection = asRecord(input.projection?.content);
  const governance = asRecord(current.governance);
  const provider = asRecord(governance.provider);
  const generationMode: 'ai' | 'fallback' = current.generationMode === 'ai' ? 'ai' : 'fallback';
  const complaint = input.patientIntake?.chiefComplaint?.trim() || input.encounterComplaint?.trim() || '';
  const patientNote = input.patientIntake?.details?.trim() || null;
  const partial = !input.complete;

  const handoff = buildClinicHandoff({
    complaint: complaint || 'No reason recorded',
    patientNote,
    age: input.patient.age,
    gender: input.patient.gender,
    allergies: input.patient.allergies,
    conditions: input.patient.conditions,
    answers: answers.map(toHandoffAnswer),
    unasked: unasked.map((item) => ({ questionId: item.questionId, question: item.question })),
    interview: {
      askedCount: typeof current.askedCount === 'number' ? current.askedCount : answers.filter((answer) => answer.source === 'ai').length,
      maxQuestions: typeof current.maxQuestions === 'number' ? current.maxQuestions : 12,
    },
    emergencyEvents,
    partial,
    // The harness never writes a model case summary into the projection.
    modelCaseSummary: generationMode === 'ai' && !isHarnessPayload(current) ? text(projection.caseSummary) || null : null,
    clinicQuestions: { expected: pinnedIds.length > 0 || !!input.clinicQuestionsExpected, answered: clinicAnswered },
  });

  // Every commentable passage is a segment. Headings and labels never are.
  const segments: CareSegment[] = [];
  const add = (id: string, kind: string, value: string | null | undefined, voice: CareSegmentVoice, section: CareSectionKey, ruleId?: string) => {
    if (value?.trim()) segments.push({ id, kind, text: value, voice, section, ...(ruleId ? { ruleId } : {}) });
  };
  const recommendedAction = handoff.nextSteps[0]?.text ?? '';
  add('summary:briefing', 'briefing', handoff.briefing, 'generated', 'summary', 'summary.briefing');
  add('summary:case', 'case_summary', handoff.caseSummary, 'generated', 'summary', generationMode === 'ai' ? 'summary.case.model' : 'summary.case');
  add('summary:action', 'recommended_action', recommendedAction, 'generated', 'next_steps', handoff.nextSteps[0]?.ruleId);
  add('urgency:sentence', 'urgency', handoff.urgency.sentence, 'generated', 'urgency', `urgency.${handoff.urgency.level}`);
  handoff.urgency.reasons.forEach((reason, index) => add(`urgency:reason:${index}`, 'urgency_reason', reason.text, 'generated', 'urgency', reason.ruleId));
  handoff.redFlags.forEach((flag, index) => add(`red-flag:${index}`, 'red_flag', flag.label, 'generated', 'red_flags', flag.ruleId));
  emergencyEvents.forEach((event, index) => {
    const trigger = answers.find((answer) => answer.questionId === event.triggerQuestionId);
    const what = event.trigger === 'safety_gate'
      ? 'Shown an emergency warning after saying they were in immediate danger.'
      : `Shown an emergency warning${trigger ? ` after answering “${trigger.answer}” to “${trigger.question}”` : ''}.`;
    const outcome = event.acknowledgedAt ? ' They chose to continue.' : ' They didn’t continue past it.';
    add(`emergency:${index}`, 'emergency', `${what}${event.reason && event.trigger !== 'safety_gate' ? ` Reason given: ${event.reason}` : ''}${outcome}`, 'record', 'emergency');
  });
  handoff.nextSteps.forEach((step, index) => add(`next:${index}`, 'next_step', step.text, 'generated', 'next_steps', step.ruleId));
  handoff.askInRoom.forEach((item, index) => {
    add(`ask:${index}`, 'ask', item.text, 'generated', 'ask_in_room', item.ruleId);
    add(`ask:${index}:why`, 'ask_why', item.why, 'generated', 'ask_in_room', item.ruleId);
  });
  handoff.gaps.forEach((gap, index) => add(`gap:${index}`, 'gap', gap.text, 'generated', 'gaps', gap.ruleId));
  for (const answer of answers) {
    const section = answer.source === 'clinic' ? 'questionnaire' : 'transcript';
    add(`question:${answer.questionId}`, 'question', answer.question, 'record', section);
    add(`answer:${answer.questionId}`, 'answer', answer.answer, 'patient', section);
    add(`why:${answer.questionId}`, 'why', answer.why, 'generated', 'transcript', 'transcript.why');
  }
  for (const item of unasked) {
    add(`unasked:${item.questionId}`, 'unasked_question', item.question, 'generated', 'not_asked', 'not_asked.question');
    add(`unasked-why:${item.questionId}`, 'unasked_why', item.clinicalReason, 'generated', 'not_asked', 'not_asked.why');
  }
  add('visit:complaint', 'visit_complaint', complaint || 'No reason recorded', 'patient', 'visit_record');
  add('visit:note', 'visit_note', patientNote, 'patient', 'visit_record');
  add('visit:allergies', 'visit_allergies', input.patient.allergies, 'patient', 'visit_record');
  add('visit:conditions', 'visit_conditions', input.patient.conditions, 'patient', 'visit_record');

  return {
    schemaVersion: 2,
    interviewStatus: input.complete ? 'complete' : 'in_progress',
    generatedAt: text(projection.generatedAt) || input.projection?.createdAt.toISOString() || null,
    generationMode,
    provider: Object.keys(provider).length ? provider : null,
    governanceVersion: text(governance.version) || null,
    governance: { version: text(governance.version) || null, decisionSupportOnly: true, humanReviewRequired: true },
    handoffGenerator: { kind: 'deterministic', rulesVersion: CLINIC_HANDOFF_RULES_VERSION, promptVersion: null, model: null },
    summary: {
      briefing: handoff.briefing,
      caseSummary: handoff.caseSummary,
      recommendedAction,
      redFlags: handoff.redFlags.map((flag) => flag.label),
      progressionRisks: [],
    },
    visitRecord: { chiefComplaint: complaint, patientNote, allergies: input.patient.allergies, conditions: input.patient.conditions },
    urgency: handoff.urgency,
    emergencyEvents,
    questionnaire,
    answers: answers.map(({ valueBoolean: _valueBoolean, valueNumber: _valueNumber, notSure: _notSure, bankKey: _bankKey, ...answer }) => answer),
    unasked,
    redFlags: handoff.redFlags,
    redFlagScreen: handoff.redFlagScreen,
    nextSteps: handoff.nextSteps,
    askInRoom: handoff.askInRoom,
    gaps: handoff.gaps,
    timedRisks: [],
    considerations: [],
    examSuggestions: [],
    segments,
  };
}
