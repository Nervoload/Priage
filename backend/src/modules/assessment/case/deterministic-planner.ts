import { applies, bankById, bankToPlanned } from '../packs';
import type { KnowledgePack } from '../packs/types';
import { subjectOf } from './case-builder';
import type { Case, PlannedQuestion } from './types';

// The planner with no model: reviewed bank questions in a fixed priority.
// It is the whole planner when no driver is configured and the fallback for
// every model call.

function usable(pack: KnowledgePack, current: Case, id: string, asked: ReadonlySet<string>): PlannedQuestion | null {
  const question = bankById(pack, id);
  if (!question || asked.has(id) || !applies(question.when, subjectOf(current))) return null;
  if (question.element && current.history[question.element] && question.targets.every((target) => target === question.element)) return null;
  return bankToPlanned(question);
}

/** Bank questions still worth asking, most important first. The closing question is not included. */
export function openItems(current: Case, pack: KnowledgePack): PlannedQuestion[] {
  const asked = new Set(current.asked.map((question) => question.key));
  const ids: string[] = [];
  const screensOf = (filter: (status: string, tier: string) => boolean) => current.candidates
    .filter((candidate) => filter(candidate.status, candidate.tier))
    .sort((left, right) => (left.tier === right.tier ? 0 : left.tier === 'cant_miss' ? -1 : 1))
    .flatMap((candidate) => candidate.askableNext);

  // 1. Dangerous causes the case supports.
  ids.push(...screensOf((status, tier) => tier === 'cant_miss' && (status === 'possible' || status === 'leading')));
  // 2. Core facts that are core history (onset, severity, course).
  ids.push(...pack.order.core.filter((id) => {
    const element = bankById(pack, id)?.element;
    return !!element && pack.coreHistory.includes(element);
  }));
  // 3. First screens for dangerous causes there's no information on yet, then the rest.
  ids.push(...screensOf((status) => status !== 'not_supported'));
  // 4. The remaining core facts, then fillers.
  ids.push(...pack.order.core, ...pack.order.fillers);

  const seen = new Set<string>();
  const items: PlannedQuestion[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const question = usable(pack, current, id, asked);
    if (question) items.push(question);
  }
  return items;
}

function closing(current: Case, pack: KnowledgePack): PlannedQuestion | null {
  return usable(pack, current, pack.order.closing, new Set(current.asked.map((question) => question.key)));
}

/** The bank question for the most important open item, or the closing question when nothing else is left. */
export function mostImportantOpenItem(current: Case, pack: KnowledgePack): PlannedQuestion | null {
  return openItems(current, pack)[0] ?? closing(current, pack);
}

/**
 * The next round from the bank. One question of the budget is kept for the
 * closing "anything else?", which is asked last.
 */
export function deterministicRound(current: Case, pack: KnowledgePack, options: { roundSize: number; remainingBudget: number }): PlannedQuestion[] {
  const last = closing(current, pack);
  const room = Math.min(options.roundSize, options.remainingBudget - (last ? 1 : 0));
  const items = room > 0 ? openItems(current, pack).slice(0, room) : [];
  if (items.length) return items;
  return last && options.remainingBudget > 0 ? [last] : [];
}
