import type { AssessmentAnalytics, FeedbackCounts } from '../../../shared/api/clinicAnalytics';

export const PERIODS = [7, 30, 90] as const;

export const SECTION_LABELS: Record<string, string> = {
  summary: 'Briefing and case summary', urgency: 'Urgency', red_flags: 'Red flags', next_steps: 'Next steps',
  ask_in_room: 'Ask in the room', gaps: 'Not established', considerations: 'Possible considerations', exam: 'Exam suggestions', timed_risks: 'Watch for',
};

export function sectionLabel(key: string): string {
  return SECTION_LABELS[key] ?? key.replace(/_/g, ' ');
}

/** A whole-number share, or a dash when there's nothing to divide. */
export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
}

export function feedbackTotal(counts: FeedbackCounts): number {
  return counts.useful + counts.notRight + counts.missing;
}

/** Share of verdicts that were Useful; "Something missing" notes aren't verdicts on an item. */
export function usefulShare(counts: FeedbackCounts): string {
  return percent(counts.useful, counts.useful + counts.notRight);
}

export const URGENCY_PARTS = [
  { key: 'escalate', label: 'Escalate', tone: 'red' },
  { key: 'caution', label: 'Caution', tone: 'amber' },
  { key: 'clear', label: 'Clear', tone: 'green' },
  { key: 'unrated', label: 'Not rated', tone: 'grey' },
] as const;

/** Each urgency level's share of visits, for the bar. Levels with no visits are left out. */
export function urgencyBar(urgency: AssessmentAnalytics['urgency']): Array<{ key: string; label: string; tone: 'red' | 'amber' | 'green' | 'grey'; count: number; share: number }> {
  const total = urgency.clear + urgency.caution + urgency.escalate + urgency.unrated;
  if (!total) return [];
  return URGENCY_PARTS.map((part) => ({ ...part, count: urgency[part.key], share: urgency[part.key] / total })).filter((part) => part.count > 0);
}

export function periodWords(days: number): string {
  return `the last ${days} days`;
}
