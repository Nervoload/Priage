import type { Candidate, CandidateDraft, ModelUrgency, SupportLevel } from './types';

// Code checks on what the model says about possible causes. The model never
// gets the last word on citations, support levels or dropping a dangerous cause.

const URGENCY_RANK: Record<ModelUrgency, number> = { none: 0, caution: 1, escalate: 2 };

/** The higher of two urgencies. Used so a model can raise urgency and never lower it. */
export function raiseOnly(left: ModelUrgency, right: ModelUrgency): ModelUrgency {
  return URGENCY_RANK[right] > URGENCY_RANK[left] ? right : left;
}

/** Keeps only citations that point at answers that exist. */
export function citeKnown(ids: readonly string[], known: ReadonlySet<string>): string[] {
  return [...new Set(ids.filter((id) => known.has(id)))];
}

/**
 * A support level must be backed by its evidence: leading and possible need an
 * answer for, less likely and not supported need an answer against. Anything
 * unbacked falls back to what the evidence does show.
 */
export function enforceSupportLevel(status: SupportLevel, forIds: readonly string[], againstIds: readonly string[]): SupportLevel {
  const hasFor = forIds.length > 0;
  const hasAgainst = againstIds.length > 0;
  if ((status === 'leading' || status === 'possible') && !hasFor) return hasAgainst ? 'less_likely' : 'not_enough_information';
  if ((status === 'less_likely' || status === 'not_supported') && !hasAgainst) return hasFor ? 'possible' : 'not_enough_information';
  return status;
}

/** Model drafts as candidates: ids resolved, citations checked, support levels enforced, duplicates merged. */
export function toCandidates(drafts: readonly CandidateDraft[], resolveId: (draft: CandidateDraft) => string, known: ReadonlySet<string>): { candidates: Candidate[]; droppedCitations: number } {
  const byId = new Map<string, Candidate>();
  let droppedCitations = 0;
  for (const draft of drafts) {
    const id = resolveId(draft);
    const forIds = citeKnown(draft.for, known);
    const againstIds = citeKnown(draft.against, known);
    droppedCitations += new Set(draft.for).size - forIds.length + new Set(draft.against).size - againstIds.length;
    const existing = byId.get(id);
    if (existing) {
      existing.for = [...new Set([...existing.for, ...forIds])];
      existing.against = [...new Set([...existing.against, ...againstIds])];
      existing.askableNext = [...new Set([...existing.askableNext, ...draft.askableNext])];
      existing.needsInPerson = [...existing.needsInPerson, ...draft.needsInPerson];
      if (draft.tier === 'cant_miss') existing.tier = 'cant_miss';
      existing.status = enforceSupportLevel(existing.status, existing.for, existing.against);
      continue;
    }
    byId.set(id, {
      id, label: draft.label.trim(), tier: draft.tier, status: enforceSupportLevel(draft.status, forIds, againstIds),
      for: forIds, against: againstIds, askableNext: [...new Set(draft.askableNext)], needsInPerson: [...draft.needsInPerson], addedBy: 'model',
    });
  }
  return { candidates: [...byId.values()], droppedCitations };
}

/**
 * Dangerous causes and audit-added causes are never dropped. If the model's new
 * list leaves one out, the previous entry stays and the omission is reported.
 * A cause that was dangerous stays dangerous.
 */
export function retainCantMiss(previous: readonly Candidate[], next: readonly Candidate[]): { candidates: Candidate[]; omissions: string[] } {
  const nextIds = new Set(next.map((candidate) => candidate.id));
  const wasCantMiss = new Set(previous.filter((candidate) => candidate.tier === 'cant_miss').map((candidate) => candidate.id));
  const candidates = next.map((candidate) => (wasCantMiss.has(candidate.id) && candidate.tier !== 'cant_miss' ? { ...candidate, tier: 'cant_miss' as const } : candidate));
  const omissions: string[] = [];
  for (const candidate of previous) {
    if (nextIds.has(candidate.id)) continue;
    if (candidate.tier === 'cant_miss' || candidate.addedBy === 'audit') {
      candidates.push(candidate);
      if (candidate.tier === 'cant_miss') omissions.push(candidate.id);
    }
  }
  return { candidates, omissions };
}
