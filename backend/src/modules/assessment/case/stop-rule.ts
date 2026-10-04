import type { Candidate, Case, HistoryElement, RoundType } from './types';

export type StopReason = 'case_done' | 'budget' | 'patient_stopped';

export interface StopContext {
  coreHistory: readonly HistoryElement[];
  /** Harness questions asked so far (not the safety or clinic questions). */
  askedCount: number;
  budget: number;
  minQuestions: number;
  patientStopped?: boolean;
}

/** No patient-answerable question can still shift this cause. */
export const askableLimitReached = (candidate: Candidate) => candidate.askableNext.length === 0;

export const coreHistorySettled = (current: Case, core: readonly HistoryElement[]) => core.every((element) => !!current.history[element]);

/**
 * Stop when the case is done (every cause at its askable limit, core history
 * filled in or marked unknown, every complaint characterised), when the
 * budget is spent, or when the patient stops.
 */
export function stopRule(current: Case, ctx: StopContext): StopReason | null {
  if (ctx.patientStopped) return 'patient_stopped';
  if (ctx.askedCount >= ctx.budget) return 'budget';
  if (ctx.askedCount < ctx.minQuestions) return null;
  const done = current.candidates.every(askableLimitReached)
    && coreHistorySettled(current, ctx.coreHistory)
    && current.complaints.every((complaint) => complaint.characterized);
  return done ? 'case_done' : null;
}

/** The round types, in order; the first that matches wins. */
export function chooseRoundType(current: Case, ctx: StopContext): RoundType | 'stop' {
  if (stopRule(current, ctx)) return 'stop';
  if (current.complaints.some((complaint) => !complaint.characterized)) return 'clarify';
  const open = current.candidates.filter((candidate) => !askableLimitReached(candidate));
  if (open.some((candidate) => candidate.tier === 'cant_miss' && (candidate.status === 'possible' || candidate.status === 'leading'))) return 'danger';
  if (open.some((candidate) => candidate.status !== 'not_supported')) return 'distinguish';
  if (!coreHistorySettled(current, ctx.coreHistory) || ctx.askedCount < ctx.minQuestions) return 'history';
  return 'stop';
}
