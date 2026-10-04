import type { InterviewAnswerRecord, InterviewQuestion } from '../../intake/interview/triage-interview.types';
import { SAFETY_GATE_PUBLIC_ID } from '../../intake/interview/triage-interview.types';

// A clinic's own questions. They are asked right after the engine's safety
// question, and every assessment keeps the version it started with, so what a
// clinician reads in Care is exactly what the patient was asked.

export const CLINIC_QUESTION_PREFIX = 'clinic:';
export const MAX_CLINIC_QUESTIONS = 8;
export const CLINIC_QUESTION_INPUT_TYPES = ['boolean', 'single_select', 'text'] as const;
export type ClinicQuestionInputType = typeof CLINIC_QUESTION_INPUT_TYPES[number];

export interface ClinicQuestion {
  /** Stable within a clinic; becomes the interview question id `clinic:<key>`. */
  key: string;
  /** Default questions start pre-filled in a clinic's first draft and can be edited or removed. */
  origin: 'default' | 'custom';
  prompt: string;
  helpText: string | null;
  inputType: ClinicQuestionInputType;
  /** Only for single_select: 2 to 6 choices. */
  choices: string[];
}

/** Asked first in every assessment by the interview engine. Admins see it as locked. */
export const LOCKED_CLINIC_QUESTIONS = [
  { key: SAFETY_GATE_PUBLIC_ID, prompt: 'Are you in immediate danger right now?', inputType: 'boolean' as const, why: 'Asked first in every assessment. A Yes shows emergency instructions straight away.' },
];

export const DEFAULT_CLINIC_QUESTIONS: readonly ClinicQuestion[] = [
  { key: 'travel_14d', origin: 'default', prompt: 'Have you travelled outside Canada in the last 14 days?', helpText: 'Include any trip, even a short one.', inputType: 'boolean', choices: [] },
];

const DEFAULT_KEYS = new Set(DEFAULT_CLINIC_QUESTIONS.map((question) => question.key));
const KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

export class ClinicQuestionnaireError extends Error {}

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const trimmed = (value: unknown): string => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

/** Checks and normalizes questions an admin wants to publish. Throws ClinicQuestionnaireError. */
export function validateClinicQuestions(input: unknown): ClinicQuestion[] {
  if (!Array.isArray(input)) throw new ClinicQuestionnaireError('Questions must be a list');
  if (input.length > MAX_CLINIC_QUESTIONS) throw new ClinicQuestionnaireError(`A clinic can ask up to ${MAX_CLINIC_QUESTIONS} questions`);
  const seen = new Set<string>();
  return input.map((raw, index) => {
    const value = asRecord(raw);
    const where = `Question ${index + 1}`;
    const key = trimmed(value.key);
    if (!KEY_PATTERN.test(key)) throw new ClinicQuestionnaireError(`${where} needs a valid key`);
    if (seen.has(key)) throw new ClinicQuestionnaireError(`${where} repeats another question’s key`);
    seen.add(key);
    const origin = value.origin === 'default' ? 'default' : 'custom';
    if (origin === 'default' && !DEFAULT_KEYS.has(key)) throw new ClinicQuestionnaireError(`${where} isn’t one of Priage’s default questions`);
    if (origin === 'custom' && DEFAULT_KEYS.has(key)) throw new ClinicQuestionnaireError(`${where} uses a key kept for a default question`);
    const prompt = trimmed(value.prompt);
    if (prompt.length < 5 || prompt.length > 200) throw new ClinicQuestionnaireError(`${where} needs a question between 5 and 200 characters`);
    const helpText = trimmed(value.helpText) || null;
    if (helpText && helpText.length > 200) throw new ClinicQuestionnaireError(`${where} has help text over 200 characters`);
    const inputType = CLINIC_QUESTION_INPUT_TYPES.find((type) => type === value.inputType);
    if (!inputType) throw new ClinicQuestionnaireError(`${where} needs an answer type`);
    const choices = inputType === 'single_select' && Array.isArray(value.choices) ? value.choices.map(trimmed).filter(Boolean) : [];
    if (inputType === 'single_select') {
      if (choices.length < 2 || choices.length > 6) throw new ClinicQuestionnaireError(`${where} needs 2 to 6 choices`);
      if (new Set(choices.map((choice) => choice.toLowerCase())).size !== choices.length) throw new ClinicQuestionnaireError(`${where} repeats a choice`);
      if (choices.some((choice) => choice.length > 80)) throw new ClinicQuestionnaireError(`${where} has a choice over 80 characters`);
    }
    return { key, origin, prompt, helpText, inputType, choices };
  });
}

/** Reads stored questions back. Anything malformed is dropped rather than trusted. */
export function parseClinicQuestions(stored: unknown): ClinicQuestion[] {
  try { return validateClinicQuestions(stored); } catch { return []; }
}

export function clinicQuestionId(key: string): string {
  return `${CLINIC_QUESTION_PREFIX}${key}`;
}

export function isClinicQuestionId(questionId: string): boolean {
  return questionId.startsWith(CLINIC_QUESTION_PREFIX);
}

/** The questions in the interview engine's shape, in the order the clinic set. */
export function toInterviewQuestions(questions: ClinicQuestion[]): InterviewQuestion[] {
  return questions.map((question) => ({
    publicId: clinicQuestionId(question.key),
    phase: 'urgent',
    inputType: question.inputType,
    prompt: question.prompt,
    helpText: question.helpText ?? '',
    placeholder: '',
    required: true,
    choices: question.inputType === 'boolean' ? ['Yes', 'No'] : question.choices,
    clinicalReason: 'Your clinic asks this of every patient.',
    askIfAmbiguous: false,
  }));
}

/**
 * Answers given outside the interview, by patients who finished the general
 * assessment before choosing this clinic. Stored like interview answers.
 */
export function clinicAnswerRecords(questions: ClinicQuestion[], input: unknown, answeredAt: Date): InterviewAnswerRecord[] {
  const answers = new Map((Array.isArray(input) ? input : []).map((raw) => {
    const value = asRecord(raw);
    return [trimmed(value.key), value] as const;
  }));
  return toInterviewQuestions(questions).map((question, index) => {
    const value = answers.get(questions[index].key) ?? {};
    const base = { questionPublicId: question.publicId, phase: question.phase, prompt: question.prompt, inputType: question.inputType, answeredAt: answeredAt.toISOString() };
    if (question.inputType === 'boolean') {
      if (typeof value.valueBoolean !== 'boolean') throw new ClinicQuestionnaireError(`Answer “${question.prompt}”`);
      return { ...base, answerText: value.valueBoolean ? 'Yes' : 'No', valueBoolean: value.valueBoolean };
    }
    if (question.inputType === 'single_select') {
      const choice = trimmed(value.valueChoice);
      if (!question.choices.includes(choice)) throw new ClinicQuestionnaireError(`Choose an answer for “${question.prompt}”`);
      return { ...base, answerText: choice, valueChoice: choice };
    }
    const text = trimmed(value.valueText);
    if (!text) throw new ClinicQuestionnaireError(`Answer “${question.prompt}”`);
    if (text.length > 1000) throw new ClinicQuestionnaireError(`Keep the answer to “${question.prompt}” under 1000 characters`);
    return { ...base, answerText: text, valueText: text };
  });
}

/** Context item holding answers given after the interview (general-site patients). */
export const CLINIC_RESPONSE_ITEM = 'clinic_questionnaire_response';

export type ClinicQuestionsStatus = 'none' | 'pending' | 'answered';

/**
 * Where a visit stands with its clinic's questions. Questions pinned in the
 * interview are answered there; otherwise a separate response is needed once
 * the clinic has published questions.
 */
export function clinicQuestionsStatus(input: { interviewState: unknown; hasResponse: boolean; activeVersion: number | null }): ClinicQuestionsStatus {
  const state = asRecord(input.interviewState);
  const pin = asRecord(state.clinicQuestionnaire);
  const pinned = (Array.isArray(pin.questions) ? pin.questions : []).map((question) => trimmed(asRecord(question).publicId)).filter(Boolean);
  if (pinned.length) {
    const answered = new Set((Array.isArray(state.answers) ? state.answers : []).map((answer) => trimmed(asRecord(answer).questionPublicId)));
    return pinned.every((id) => answered.has(id)) ? 'answered' : 'pending';
  }
  if (input.hasResponse) return 'answered';
  return input.activeVersion ? 'pending' : 'none';
}
