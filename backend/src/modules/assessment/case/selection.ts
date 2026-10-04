import { checkQuestion, normalizeQuestion, type CheckContext } from './question-checks';
import type { AskInRoomItem, Case, HistoryElement, PlannedQuestion, RoundType } from './types';
import { elementsFilled, passesValueTest } from './value-test';

export interface SelectOptions extends Omit<CheckContext, 'current'> {
  roundType: RoundType;
  /** Questions left in the assessment's budget. */
  remainingBudget: number;
  coreHistory: readonly HistoryElement[];
  /** Most questions to serve this round. */
  roundSize?: number;
}

export interface Selection {
  chosen: PlannedQuestion[];
  askInRoom: AskInRoomItem[];
  notChosen: Array<{ question: PlannedQuestion; reason: string }>;
}

export const ROUND_SIZE = { min: 2, max: 4 } as const;
const BURDEN = { low: 0, medium: 1, high: 2 } as const;

/** A question about a dangerous cause the case already supports. */
export function aboutSupportedDanger(question: PlannedQuestion, current: Case): boolean {
  return question.purpose === 'danger' && question.targets.some((target) => current.candidates.some((candidate) =>
    candidate.id === target && candidate.tier === 'cant_miss' && (candidate.status === 'possible' || candidate.status === 'leading')));
}

/** A cheap check of a dangerous cause there is no information on yet; one may join any round. */
function isDangerCheck(question: PlannedQuestion, current: Case): boolean {
  return question.purpose === 'danger' && question.targets.length > 0 && question.targets.every((target) => current.candidates.some((candidate) =>
    candidate.id === target && candidate.tier === 'cant_miss' && candidate.status === 'not_enough_information'));
}

/** Touches a dangerous cause that history hasn't argued against yet. */
function touchesOpenDanger(question: PlannedQuestion, current: Case): boolean {
  return question.targets.some((target) => current.candidates.some((candidate) =>
    candidate.id === target && candidate.tier === 'cant_miss' && candidate.status !== 'not_supported'));
}

function causesAffected(question: PlannedQuestion, current: Case): number {
  const ids = new Set(current.candidates.map((candidate) => candidate.id));
  const targets = new Set([...question.targets, ...question.ifAnswered.flatMap((outcome) => outcome.effects.map((effect) => effect.target))]);
  return [...targets].filter((target) => ids.has(target)).length;
}

function fillsMissingCore(question: PlannedQuestion, current: Case, core: readonly HistoryElement[]): boolean {
  return elementsFilled(question).some((element) => core.includes(element) && !current.history[element]);
}

/**
 * Picks the round's questions from the planner's proposals: drop anything
 * that fails a check or can't change the case, move clinician questions to
 * "ask in the room", keep to the round's purpose (plus one other question and
 * one danger check), order by priority, and take the top few.
 */
export function selectQuestions(proposed: readonly PlannedQuestion[], current: Case, options: SelectOptions): Selection {
  const notChosen: Selection['notChosen'] = [];
  const askInRoom: AskInRoomItem[] = [];
  const candidates: Array<{ question: PlannedQuestion; index: number }> = [];
  const seen = new Set<string>();

  proposed.forEach((question, index) => {
    const key = normalizeQuestion(question.text);
    if (seen.has(key)) return notChosen.push({ question, reason: 'duplicate' });
    seen.add(key);
    const problems = checkQuestion(question, { current, causeTerms: options.causeTerms, allowLongText: options.allowLongText });
    if (problems.length) return notChosen.push({ question, reason: problems.join(',') });
    if (!passesValueTest(question, current)) return notChosen.push({ question, reason: 'no_value' });
    if (question.betterInRoom || question.burden === 'high') {
      askInRoom.push({ text: question.text, reason: question.betterInRoom?.trim() || 'Better asked in person.', answerIds: [] });
      return;
    }
    candidates.push({ question, index });
  });

  const rank = (entry: { question: PlannedQuestion; index: number }) => [
    aboutSupportedDanger(entry.question, current) ? 0 : 1,
    touchesOpenDanger(entry.question, current) ? 0 : 1,
    -causesAffected(entry.question, current),
    fillsMissingCore(entry.question, current, options.coreHistory) ? 0 : 1,
    BURDEN[entry.question.burden],
    entry.index,
  ];
  candidates.sort((left, right) => {
    const a = rank(left);
    const b = rank(right);
    // The last rank is the planner's own order, so two proposals never tie.
    for (let i = 0; i < a.length - 1; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
    return a[a.length - 1] - b[b.length - 1];
  });

  const limit = Math.max(0, Math.min(options.roundSize ?? ROUND_SIZE.max, options.remainingBudget));
  const chosen: PlannedQuestion[] = [];
  let offPurpose = 0;
  let dangerChecks = 0;
  for (const { question } of candidates) {
    if (chosen.length >= limit) {
      notChosen.push({ question, reason: 'not_selected' });
      continue;
    }
    if (question.purpose !== options.roundType) {
      if (options.roundType !== 'danger' && isDangerCheck(question, current)) {
        if (dangerChecks >= 1) { notChosen.push({ question, reason: 'off_purpose' }); continue; }
        dangerChecks += 1;
      } else {
        if (offPurpose >= 1) { notChosen.push({ question, reason: 'off_purpose' }); continue; }
        offPurpose += 1;
      }
    }
    // Questions about a dangerous cause the case supports are always shown on their own.
    chosen.push(aboutSupportedDanger(question, current) ? { ...question, group: undefined } : question);
  }
  return { chosen, askInRoom, notChosen };
}
