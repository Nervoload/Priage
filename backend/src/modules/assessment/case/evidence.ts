import { isVagueAnswer } from '../../clinic/care/patient-text';
import type { NormalizedAnswer } from './answers';
import {
  HISTORY_ELEMENTS, type AnswerOutcome, type AnsweredBy, type Case, type EvidenceItem, type HistoryElement, type Language, type PlannedQuestion,
} from './types';

export interface AnswerContext {
  answerId: string;
  language: Language;
  answeredBy: AnsweredBy;
}

const isHistoryElement = (target: string): target is HistoryElement => (HISTORY_ELEMENTS as readonly string[]).includes(target);

function inRange(key: string, value: number): boolean {
  const range = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(key);
  if (range) return value >= Number(range[1]) && value <= Number(range[2]);
  return key.trim() === String(value);
}

/** The outcomes an answer selects from the question's `ifAnswered`. "Not sure" selects none. */
export function matchedOutcomes(question: PlannedQuestion, answer: NormalizedAnswer): AnswerOutcome[] {
  if (answer.notSure) return [];
  switch (question.format) {
    case 'boolean':
    case 'single_select':
      return question.ifAnswered.filter((outcome) => outcome.answer === answer.answerText);
    case 'multi_select':
      return question.ifAnswered.filter((outcome) => answer.valueChoices?.includes(outcome.answer));
    case 'scale':
    case 'number':
      return typeof answer.valueNumber === 'number' ? question.ifAnswered.filter((outcome) => inRange(outcome.answer, answer.valueNumber as number)) : [];
    default:
      return [];
  }
}

function describe(question: PlannedQuestion, answer: string): string {
  return `“${question.text}” answered “${answer}”`;
}

/** Evidence from a structured answer, through the question's targets. Free text gets a single item until the reader reads it. */
export function structuredEvidence(question: PlannedQuestion, answer: NormalizedAnswer, ctx: AnswerContext): EvidenceItem[] {
  const base = { answerId: ctx.answerId, language: ctx.language, answeredBy: ctx.answeredBy, ...(question.element ? { element: question.element } : {}) };
  const item = (index: number, kind: EvidenceItem['kind'], value: string, targets: string[], patientWords: string): EvidenceItem =>
    ({ id: `${ctx.answerId}#${index}`, ...base, kind, value, targets, patientWords, source: 'structured' });

  if (answer.notSure) return [item(0, 'not_sure', describe(question, 'Not sure'), [...question.targets], answer.originalText)];

  if (question.format === 'multi_select') {
    // A checklist: every option not ticked counts as denied.
    const chosen = new Set(answer.valueChoices ?? []);
    return (question.choices ?? []).map((choice, index) => {
      const outcome = question.ifAnswered.find((entry) => entry.answer === choice);
      const targets = [...new Set([...question.targets, ...(outcome?.effects.map((effect) => effect.target) ?? [])])];
      return item(index, chosen.has(choice) ? 'reported' : 'denied', describe(question, chosen.has(choice) ? choice : `not ${choice}`), targets, answer.originalText);
    });
  }

  const kind: EvidenceItem['kind'] = question.format === 'boolean' && answer.valueBoolean === false ? 'denied'
    : (question.format === 'text' || question.format === 'textarea') && isVagueAnswer(answer.answerText, question.format) ? 'vague'
      : 'reported';
  const targets = [...new Set([...question.targets, ...matchedOutcomes(question, answer).flatMap((outcome) => outcome.effects.map((effect) => effect.target))])];
  const evidence = item(0, kind, describe(question, answer.answerText), targets, answer.originalText);
  return [question.format === 'boolean' && answer.valueBoolean === true ? { ...evidence, affirms: question.text } : evidence];
}

/** The patient's opening words, cited as `visit:complaint` and `visit:note`. */
export function descriptionEvidence(complaint: string, note: string | null, ctx: { language: Language; answeredBy: AnsweredBy }): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const add = (answerId: string, text: string) => items.push({
    id: `${answerId}#0`, answerId, kind: 'reported', targets: [], value: text, patientWords: text,
    language: ctx.language, answeredBy: ctx.answeredBy, source: 'description',
  });
  if (complaint.trim()) add('visit:complaint', complaint.trim());
  if (note?.trim()) add('visit:note', note.trim());
  return items;
}

export interface AnswerSignals {
  /** The answer means the patient should see the emergency warning now. */
  emergency: boolean;
  /** Dangerous causes in the case this answer supports. Ends the round early. */
  supportsCantMiss: string[];
}

export function answerSignals(question: PlannedQuestion, answer: NormalizedAnswer, current: Case): AnswerSignals {
  const outcomes = matchedOutcomes(question, answer);
  const cantMiss = new Set(current.candidates.filter((candidate) => candidate.tier === 'cant_miss').map((candidate) => candidate.id));
  const supports = outcomes.flatMap((outcome) => outcome.effects).filter((effect) => effect.shift === 'supports' && cantMiss.has(effect.target)).map((effect) => effect.target);
  return { emergency: outcomes.some((outcome) => outcome.emergency === true), supportsCantMiss: [...new Set(supports)] };
}

/** Adds an answer's evidence to the case and records the question as asked. Returns a new case. */
export function recordAnswer(current: Case, question: PlannedQuestion, answer: NormalizedAnswer, ctx: AnswerContext): Case {
  const evidence = structuredEvidence(question, answer, ctx);
  const history = { ...current.history };
  const mark = (element: HistoryElement, status: 'filled' | 'unknown', ids: string[]) => {
    const previous = history[element];
    // A real answer always wins over an earlier "not sure".
    const next = previous?.status === 'filled' && status === 'unknown' ? 'filled' : status;
    history[element] = { status: next, evidenceIds: [...new Set([...(previous?.evidenceIds ?? []), ...ids])] };
  };
  const ids = evidence.map((item) => item.id);
  const settled = evidence.some((item) => item.kind === 'reported' || item.kind === 'denied');
  const elements = new Set<HistoryElement>([
    ...(question.element ? [question.element] : []),
    ...matchedOutcomes(question, answer).flatMap((outcome) => outcome.effects).filter((effect) => effect.shift === 'fills' && isHistoryElement(effect.target)).map((effect) => effect.target as HistoryElement),
  ]);
  for (const element of elements) mark(element, settled ? 'filled' : 'unknown', ids);
  return {
    ...current,
    evidence: [...current.evidence, ...evidence],
    history,
    asked: [...current.asked, { key: question.key, text: question.text, targets: [...question.targets], ...(question.element ? { element: question.element } : {}), answerId: ctx.answerId }],
  };
}
