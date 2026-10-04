import type { CareSectionKey, CareSnapshotContentV2 } from './care-snapshot';

export type CareFeedbackKind = 'USEFUL' | 'NOT_RIGHT' | 'MISSING';

/**
 * Sections whose text the clinic handoff generator wrote. Feedback is about
 * that generator, so the patient's words, the interview's own "why we asked"
 * and the emergency record are out of scope.
 */
export const CARE_FEEDBACK_SECTIONS = [
  'summary', 'urgency', 'red_flags', 'next_steps', 'ask_in_room', 'gaps', 'considerations', 'exam', 'timed_risks',
] as const satisfies readonly CareSectionKey[];

export interface CareFeedbackInput { kind: CareFeedbackKind; segmentId?: string; sectionKey?: string; note?: string }

export interface CareFeedbackTarget {
  targetKey: string;
  segmentId: string | null;
  sectionKey: string;
  ruleId: string | null;
  generatorKind: string;
  generatorVersion: string | null;
  note: string | null;
}

export class CareFeedbackError extends Error {}

const SECTIONS = new Set<string>(CARE_FEEDBACK_SECTIONS);

/** Resolves what a piece of feedback is about, and which generator and rule produced it. */
export function feedbackTarget(content: CareSnapshotContentV2, input: CareFeedbackInput): CareFeedbackTarget {
  const { kind, rulesVersion, promptVersion } = content.handoffGenerator;
  const generator = { generatorKind: kind, generatorVersion: kind === 'model' ? promptVersion : rulesVersion };
  const note = input.note?.trim() || null;
  if (input.kind === 'MISSING') {
    if (!input.sectionKey || !SECTIONS.has(input.sectionKey)) throw new CareFeedbackError('Choose the section that missed something');
    if (!note || note.length < 3) throw new CareFeedbackError('Say what was missing');
    return { targetKey: `missing:${input.sectionKey}`, segmentId: null, sectionKey: input.sectionKey, ruleId: null, note, ...generator };
  }
  const segment = input.segmentId ? content.segments.find((item) => item.id === input.segmentId) : undefined;
  if (!segment) throw new CareFeedbackError('That item isn’t in this assessment');
  if (segment.voice !== 'generated' || !segment.section || !SECTIONS.has(segment.section)) throw new CareFeedbackError('Feedback is only for text Priage generated');
  return { targetKey: segment.id, segmentId: segment.id, sectionKey: segment.section, ruleId: segment.ruleId ?? null, note: input.kind === 'NOT_RIGHT' ? note : null, ...generator };
}
