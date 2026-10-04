import { NONE_OF_THESE, NOT_SURE } from '../packs/fixed-wording';
import { normalizeLabel, wholeWord } from './audit';
import { ASSESSMENT_INPUT_TYPES, HISTORY_ELEMENTS, type Case, type PlannedQuestion } from './types';

// Code checks every question before a patient sees it. A question that fails
// any check is dropped and kept in the case's "not chosen" list for audit.

export type QuestionProblem =
  | 'empty' | 'too_long' | 'multiple_ideas' | 'names_cause' | 'advice' | 'repeat'
  | 'format' | 'long_text' | 'choices' | 'unknown_target' | 'outcomes';

export const MAX_QUESTION_LENGTH = 160;
const MIN_CHOICES = 2;
const MAX_CHOICES = 8;

/** Diagnosis, reassurance or treatment advice inside a question. */
const ADVICE = /\b(you should|you need to|you must|don['’]?t worry|nothing to worry|nothing serious|probably (just|nothing|fine)|it['’]?s likely|it is likely|diagnos\w*|we recommend|i recommend|try taking)\b/i;

export interface CheckContext {
  current: Case;
  /** Normalized cause names (pack and case) a question must not say. */
  causeTerms: readonly string[];
  /** Long text is only for the opening description and the closing question. */
  allowLongText?: boolean;
}

export const normalizeQuestion = (text: string) => normalizeLabel(text).replace(/[?!]/g, '').trim();

function isRepeat(question: PlannedQuestion, current: Case): boolean {
  const text = normalizeQuestion(question.text);
  return current.asked.some((asked) => {
    if (asked.key === question.key || normalizeQuestion(asked.text) === text) return true;
    if (!question.element || asked.element !== question.element) return false;
    const sameTargets = asked.targets.length === question.targets.length && asked.targets.every((target) => question.targets.includes(target));
    return sameTargets;
  }) || (!!question.element && !!current.history[question.element] && question.targets.every((target) => target === question.element));
}

function choiceProblems(question: PlannedQuestion): QuestionProblem[] {
  if (question.format !== 'single_select' && question.format !== 'multi_select') return [];
  const choices = (question.choices ?? []).map((choice) => choice.trim());
  const reserved = [NOT_SURE.en, NONE_OF_THESE.en].map((value) => value.toLowerCase());
  const bad = choices.length < MIN_CHOICES || choices.length > MAX_CHOICES || choices.some((choice) => !choice)
    || new Set(choices.map((choice) => choice.toLowerCase())).size !== choices.length
    || choices.some((choice) => reserved.includes(choice.toLowerCase()));
  return bad ? ['choices'] : [];
}

function outcomeProblems(question: PlannedQuestion): QuestionProblem[] {
  const answers = new Set(question.ifAnswered.map((outcome) => outcome.answer));
  if (question.format === 'boolean') return answers.has('Yes') && answers.has('No') ? [] : ['outcomes'];
  if (question.format === 'single_select' || question.format === 'multi_select') {
    return (question.choices ?? []).every((choice) => answers.has(choice)) ? [] : ['outcomes'];
  }
  return [];
}

export function checkQuestion(question: PlannedQuestion, ctx: CheckContext): QuestionProblem[] {
  const problems: QuestionProblem[] = [];
  const text = question.text.trim();
  if (!text) return ['empty'];
  if (text.length > MAX_QUESTION_LENGTH) problems.push('too_long');
  if ((text.match(/\?/g) ?? []).length > 1) problems.push('multiple_ideas');
  const normalized = normalizeLabel(text);
  if (ctx.causeTerms.some((term) => term && wholeWord(normalized, term))) problems.push('names_cause');
  if (ADVICE.test(text)) problems.push('advice');
  if (isRepeat(question, ctx.current)) problems.push('repeat');
  if (!ASSESSMENT_INPUT_TYPES.includes(question.format)) problems.push('format');
  else if (question.format === 'textarea' && !ctx.allowLongText) problems.push('long_text');
  problems.push(...choiceProblems(question));
  if (question.source === 'model') {
    const known = new Set<string>([...HISTORY_ELEMENTS, ...ctx.current.candidates.map((candidate) => candidate.id)]);
    if (!question.targets.length || question.targets.some((target) => !known.has(target))) problems.push('unknown_target');
  }
  problems.push(...outcomeProblems(question));
  return problems;
}
