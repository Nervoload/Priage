import { HISTORY_ELEMENTS, type AnswerOutcome, type Case, type HistoryElement, type PlannedQuestion } from './types';

const isHistoryElement = (target: string): target is HistoryElement => (HISTORY_ELEMENTS as readonly string[]).includes(target);

function signature(outcome: AnswerOutcome): string {
  const effects = outcome.effects.map((effect) => `${effect.target}:${effect.shift}`).sort();
  return `${effects.join('|')}${outcome.emergency ? '|!' : ''}`;
}

/** History elements this question would fill. */
export function elementsFilled(question: PlannedQuestion): HistoryElement[] {
  const fromEffects = question.ifAnswered.flatMap((outcome) => outcome.effects).filter((effect) => effect.shift === 'fills' && isHistoryElement(effect.target)).map((effect) => effect.target as HistoryElement);
  return [...new Set([...(question.element ? [question.element] : []), ...fromEffects])];
}

/**
 * A question is worth asking when different answers would change the case
 * differently, or when it fills a history element that isn't settled yet.
 */
export function passesValueTest(question: PlannedQuestion, current: Case): boolean {
  const signatures = new Set(question.ifAnswered.map(signature));
  // A checklist always has one more outcome: nothing ticked.
  if (question.format === 'multi_select') signatures.add('');
  if (signatures.size >= 2) return true;
  return elementsFilled(question).some((element) => !current.history[element]);
}
