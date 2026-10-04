import { describe, expect, it, vi } from 'vitest';

import { summarizeAssessments, type FeedbackRow } from '../src/modules/clinic/analytics/assessment-analytics';
import { ClinicAnalyticsService } from '../src/modules/clinic/analytics/clinic-analytics.service';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 3, 14, minute));
const feedback = (kind: FeedbackRow['kind'], extra: Partial<FeedbackRow> = {}): FeedbackRow => ({
  kind, sectionKey: 'gaps', ruleId: 'gap.not_screened', generatorKind: 'deterministic', generatorVersion: 'clinic-handoff-rules@1',
  segmentId: 'gap:0', snapshotId: 1, note: null, createdAt: at(0), ...extra,
});

describe('assessment analytics', () => {
  it('counts each visit once, from its latest snapshot', () => {
    const summary = summarizeAssessments({
      snapshots: [
        { encounterId: 7, version: 1, content: { urgency: { level: 'clear' } } },
        { encounterId: 7, version: 2, content: { urgency: { level: 'escalate' }, emergencyEvents: [{ acknowledgedAt: '2026-10-03T14:00:00Z' }], askInRoom: [{}, {}], questionnaire: { timing: 'in_interview' } } },
        { encounterId: 8, version: 1, content: { urgency: { level: 'caution' }, emergencyEvents: [{ acknowledgedAt: null }], questionnaire: { timing: 'after_interview' } } },
        { encounterId: 9, version: 1, content: { gaps: [{ kind: 'clinic_questions_missing' }] } },
      ],
      segmentText: () => null,
      feedback: [],
      askQuestions: [{ addressedAt: at(1), answerText: 'Only on stairs' }, { addressedAt: at(2), answerText: ' ' }, { addressedAt: null, answerText: null }],
    });
    expect(summary).toMatchObject({
      visits: 3,
      urgency: { clear: 0, caution: 1, escalate: 1, unrated: 1 },
      emergency: { shown: 2, continued: 1 },
      askInRoom: { suggested: 2, asked: 2, answered: 1 },
      clinicQuestions: { inInterview: 1, afterInterview: 1, missing: 1 },
    });
  });

  it('ranks sections, rules and generator versions by what clinicians said was not right', () => {
    const summary = summarizeAssessments({
      snapshots: [],
      segmentText: () => null,
      feedback: [
        feedback('USEFUL', { sectionKey: 'urgency', ruleId: 'urgency.clear' }),
        feedback('NOT_RIGHT'),
        feedback('NOT_RIGHT'),
        feedback('MISSING', { sectionKey: 'ask_in_room', ruleId: null, segmentId: null, generatorVersion: null }),
      ],
      askQuestions: [],
    });
    expect(summary.feedback.totals).toEqual({ useful: 1, notRight: 2, missing: 1 });
    expect(summary.feedback.bySection.map((row) => row.sectionKey)).toEqual(['gaps', 'ask_in_room', 'urgency']);
    expect(summary.feedback.byRule).toEqual([{ ruleId: 'gap.not_screened', useful: 0, notRight: 2, missing: 0 }, { ruleId: 'urgency.clear', useful: 1, notRight: 0, missing: 0 }]);
    expect(summary.feedback.byGenerator.map((row) => row.generator)).toEqual(['deterministic clinic-handoff-rules@1', 'deterministic']);
  });

  it('lists the newest notes with the item they were about', () => {
    const summary = summarizeAssessments({
      snapshots: [],
      segmentText: (snapshotId, segmentId) => `${snapshotId}/${segmentId}`,
      feedback: [
        feedback('NOT_RIGHT', { note: ' Already screened at the desk ', createdAt: at(1) }),
        feedback('MISSING', { note: 'Tetanus status', segmentId: null, createdAt: at(5) }),
        feedback('USEFUL', { note: 'ignored' }),
        feedback('NOT_RIGHT', { note: null }),
      ],
      askQuestions: [],
      noteLimit: 5,
    });
    expect(summary.recentNotes).toEqual([
      { kind: 'MISSING', sectionKey: 'gaps', ruleId: 'gap.not_screened', note: 'Tetanus status', itemText: null, createdAt: at(5).toISOString() },
      { kind: 'NOT_RIGHT', sectionKey: 'gaps', ruleId: 'gap.not_screened', note: 'Already screened at the desk', itemText: '1/gap:0', createdAt: at(1).toISOString() },
    ]);
  });
});

describe('clinic analytics service', () => {
  it('reads one period for the clinic, quotes noted items from older snapshots, and records the read', async () => {
    const prisma = {
      careAssessmentSnapshot: {
        findMany: vi.fn().mockResolvedValue([])
          .mockResolvedValueOnce([{ id: 2, encounterId: 7, version: 1, content: { urgency: { level: 'clear' } } }])
          .mockResolvedValueOnce([{ id: 1, content: { segments: [{ id: 'gap:0', text: 'Not screened: fainting' }] } }]),
      },
      careAiFeedback: { findMany: vi.fn(async () => [{ ...feedback('NOT_RIGHT', { note: 'Asked at the desk' }), updatedAt: at(3) }]) },
      careOpenQuestion: { findMany: vi.fn(async () => []) },
    };
    const audit = { record: vi.fn() };
    const service = new ClinicAnalyticsService(prisma as never, { assertTenantEnabled: vi.fn() } as never, audit as never);
    const result = await service.assessment({ userId: 5, hospitalId: 4 }, 45);
    expect(result.days).toBe(30);
    expect(result.recentNotes[0].itemText).toBe('Not screened: fainting');
    expect(prisma.careAssessmentSnapshot.findMany).toHaveBeenLastCalledWith({ where: { id: { in: [1] }, hospitalId: 4 }, select: { id: true, content: true } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ hospitalId: 4, metadata: expect.objectContaining({ view: 'care_assessment_analytics', days: 30, visits: 1 }) }));
    expect((await service.assessment({ userId: 5, hospitalId: 4 }, 7)).days).toBe(7);
  });
});
