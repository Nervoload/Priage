import { describe, expect, it } from 'vitest';

import { CareFeedbackError, feedbackTarget } from '../src/modules/clinic/care/care-feedback';
import type { CareSnapshotContentV2 } from '../src/modules/clinic/care/care-snapshot';

const content = (kind: 'deterministic' | 'model' = 'deterministic') => ({
  handoffGenerator: { kind, rulesVersion: 'clinic-handoff-rules@1', promptVersion: kind === 'model' ? 'clinic-handoff-prompt@3' : null, model: null },
  segments: [
    { id: 'gap:0', kind: 'gap', text: 'Not screened: trouble breathing', voice: 'generated', section: 'gaps', ruleId: 'gap.not_screened.breathing' },
    { id: 'answer:q1', kind: 'answer', text: 'Since Sunday', voice: 'patient', section: 'transcript' },
    { id: 'why:q1', kind: 'why', text: 'Onset matters.', voice: 'generated', section: 'transcript', ruleId: 'transcript.why' },
  ],
}) as unknown as CareSnapshotContentV2;

describe('care feedback targets', () => {
  it('ties item feedback to the segment, its section, rule and generator version', () => {
    expect(feedbackTarget(content(), { kind: 'USEFUL', segmentId: 'gap:0', note: 'ignored' })).toEqual({
      targetKey: 'gap:0', segmentId: 'gap:0', sectionKey: 'gaps', ruleId: 'gap.not_screened.breathing',
      generatorKind: 'deterministic', generatorVersion: 'clinic-handoff-rules@1', note: null,
    });
    expect(feedbackTarget(content(), { kind: 'NOT_RIGHT', segmentId: 'gap:0', note: '  They were asked at the desk ' }).note).toBe('They were asked at the desk');
    expect(feedbackTarget(content('model'), { kind: 'USEFUL', segmentId: 'gap:0' }).generatorVersion).toBe('clinic-handoff-prompt@3');
  });

  it('only accepts generated handoff text that is in this snapshot', () => {
    expect(() => feedbackTarget(content(), { kind: 'USEFUL', segmentId: 'answer:q1' })).toThrow(CareFeedbackError);
    expect(() => feedbackTarget(content(), { kind: 'NOT_RIGHT', segmentId: 'why:q1' })).toThrow('Feedback is only for text Priage generated');
    expect(() => feedbackTarget(content(), { kind: 'USEFUL', segmentId: 'gap:9' })).toThrow('That item isn’t in this assessment');
    expect(() => feedbackTarget(content(), { kind: 'USEFUL' })).toThrow(CareFeedbackError);
  });

  it('keys a Something missing note to its section and requires the note', () => {
    expect(feedbackTarget(content(), { kind: 'MISSING', sectionKey: 'ask_in_room', note: 'Ask about tetanus status' })).toMatchObject({ targetKey: 'missing:ask_in_room', segmentId: null, ruleId: null, note: 'Ask about tetanus status' });
    expect(() => feedbackTarget(content(), { kind: 'MISSING', sectionKey: 'ask_in_room', note: ' ' })).toThrow('Say what was missing');
    expect(() => feedbackTarget(content(), { kind: 'MISSING', sectionKey: 'transcript', note: 'Something' })).toThrow('Choose the section that missed something');
  });
});
