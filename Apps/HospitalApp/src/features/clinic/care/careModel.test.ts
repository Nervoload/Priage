import { describe, expect, it } from 'vitest';
import type { CareQueueItem, CareSnapshotContentV1, CareSnapshotContentV2, CareState } from '../../../shared/api/care';
import {
  appendToNote, askLineForNote, clinicQuestionsAside, feedbackFor, commentRangesFor, copySectionFor, quoteForNote, composeChart, finishChecklist, groupAnswers, legacyBriefing, nextReady, normalizeSnapshot, patientMeta,
  queueGroups, queueStatus, splitRuns, urgencyTone, validateSelection, waitWords,
} from './careModel';

const v1: CareSnapshotContentV1 = {
  interviewStatus: 'complete', generatedAt: '2026-10-03T14:00:00.000Z', generationMode: 'fallback', provider: null, governanceVersion: null,
  summary: { briefing: 'Patient reports sore throat, with current intake urgency low and provisional AI CTAS 4.', caseSummary: 'Chief concern: sore throat.', recommendedAction: 'Same-day medical assessment is recommended.', redFlags: ['fever'], progressionRisks: ['Worsening'] },
  answers: [
    { questionId: 'safety_immediate_danger', question: 'Are you in immediate danger right now?', answer: 'No', phase: 'urgent', answeredAt: '2026-10-03T13:58:00.000Z', entryMode: 'PATIENT_SELF', enteredByUserId: null },
    { questionId: 'q1', question: 'When did this start?', answer: 'Sunday', phase: 'urgent', answeredAt: '2026-10-03T13:59:00.000Z', entryMode: 'PATIENT_SELF', enteredByUserId: null },
    { questionId: 'q2', question: 'Medications?', answer: 'None', phase: 'history', answeredAt: '2026-10-03T14:00:00.000Z', entryMode: 'STAFF_ASSISTED', enteredByUserId: 9 },
  ],
  unasked: [{ questionId: 'u1', question: 'Worse with activity?', phase: 'emergent', clinicalReason: 'Instability screen.' }],
  segments: [{ id: 'summary:briefing', kind: 'briefing', text: 'Patient reports sore throat, with current intake urgency low and provisional AI CTAS 4.' }],
};

const v2: CareSnapshotContentV2 = {
  ...v1,
  schemaVersion: 2,
  summary: { briefing: '34-year-old female with “Sore throat”.', caseSummary: 'Chief concern: Sore throat.', recommendedAction: 'No high-risk answers. Routine visit.', redFlags: [], progressionRisks: [] },
  governance: { version: null, decisionSupportOnly: true, humanReviewRequired: true },
  handoffGenerator: { kind: 'deterministic', rulesVersion: 'clinic-handoff-rules@1', promptVersion: null, model: null },
  visitRecord: { chiefComplaint: 'Sore throat', patientNote: 'Worse at night', allergies: null, conditions: null },
  urgency: { level: 'caution', sentence: 'Caution: worth checking early in the visit', reasons: [{ id: 'r', ruleId: 'caution.severity', text: 'Severity 7/10', refs: ['answer:q1'] }] },
  emergencyEvents: [],
  questionnaire: null,
  answers: v1.answers.map((answer) => ({ ...answer, source: answer.questionId === 'safety_immediate_danger' ? 'safety' : 'ai', stage: answer.questionId === 'safety_immediate_danger' ? null : answer.phase === 'history' ? 'history' : 'red_flag_screen', why: 'Because.', inputType: 'text' })),
  unasked: [{ ...v1.unasked[0], stage: 'narrowing' }],
  redFlags: [],
  redFlagScreen: [{ domain: 'breathing', label: 'Trouble breathing', status: 'denied', refs: ['answer:q1'] }],
  nextSteps: [{ id: 'next:level', ruleId: 'next.caution', text: 'Check the reasons above early in the visit.', refs: [] }],
  askInRoom: [{ id: 'ask', ruleId: 'ask.exam.severity', text: 'Recheck the pain score now.', why: 'It was 7/10.', basedOn: ['answer:q1'], priority: 'worth', category: 'exam' }],
  gaps: [{ id: 'gap', ruleId: 'gap.missing_history', kind: 'missing_history', text: 'Allergies weren’t established', refs: [] }],
  timedRisks: [],
  considerations: [],
  examSuggestions: [],
  segments: [{ id: 'summary:briefing', kind: 'briefing', text: '34-year-old female with “Sore throat”.', voice: 'generated', section: 'summary' }],
};

const state = {
  encounter: { id: 7, status: 'CARE', chiefComplaint: 'Sore throat', details: 'AI text', arrivedAt: null, seenAt: null, departedAt: null, patient: { firstName: 'Maya', lastName: 'Chen', age: 34, gender: 'F', allergies: null, conditions: 'Asthma', optionalHealthInfo: null }, contact: null, appointment: null },
  note: { text: 'Subjective\nSore throat.', version: 4, finalizedAt: null, updatedAt: null, updatedByUserId: null, history: [] },
  comments: [
    { id: 1, snapshotId: 5, segmentId: 'answer:q1', startOffset: 0, endOffset: 3, quote: 'Sun', text: 'Which Sunday?', version: 1, resolvedAt: null, actorUserId: 2, updatedAt: '' },
    { id: 2, snapshotId: 5, segmentId: 'answer:q1', startOffset: 10, endOffset: 12, quote: 'xx', text: 'Hidden', version: 1, resolvedAt: '2026-10-03', actorUserId: 2, updatedAt: '' },
  ],
  openQuestions: [{ id: 3, text: 'Ask about travel', version: 1, addressedAt: null, actorUserId: 2 }],
} as unknown as CareState;

describe('snapshot normalization', () => {
  it('reads a v1 snapshot with the CTAS text trimmed and new sections empty', () => {
    const view = normalizeSnapshot(v1);
    expect(view.schemaVersion).toBe(1);
    expect(view.briefing).toBe('Patient reports sore throat');
    expect(view.segments.get('summary:briefing')?.text).toBe('Patient reports sore throat');
    expect(view.urgency).toBeNull();
    expect(view.askInRoom).toEqual([]);
    expect(view.answers.map((answer) => [answer.source, answer.stage])).toEqual([['safety', null], ['ai', 'red_flag_screen'], ['ai', 'history']]);
    expect(view.timedRisks.map((risk) => risk.text)).toEqual(['Worsening']);
  });

  it('reads a v2 snapshot with segment ids for every list item', () => {
    const view = normalizeSnapshot(v2);
    expect(view.schemaVersion).toBe(2);
    expect(view.urgency?.level).toBe('caution');
    expect(view.askInRoom[0]).toMatchObject({ segmentId: 'ask:0', whySegmentId: 'ask:0:why' });
    expect(view.gaps[0].segmentId).toBe('gap:0');
    expect(view.visitRecord?.patientNote).toBe('Worse at night');
    expect(legacyBriefing('No marker here.')).toBe('No marker here.');
  });

  it('groups answers safety first, then by stage', () => {
    expect(groupAnswers(normalizeSnapshot(v2).answers).map((group) => [group.label, group.answers.length])).toEqual([['Safety check', 1], ['Red-flag screen', 1], ['History', 1]]);
  });
});

describe('highlights and selection', () => {
  it('splits overlapping comment ranges into runs', () => {
    const runs = splitRuns('Sunday morning', [{ id: 1, start: 0, end: 6, resolved: false }, { id: 2, start: 3, end: 14, resolved: true }]);
    expect(runs.map((run) => [run.text, run.commentIds])).toEqual([['Sun', [1]], ['day', [1, 2]], [' morning', [2]]]);
    expect(runs[2].resolvedOnly).toBe(true);
    expect(splitRuns('abc', [])).toEqual([{ text: 'abc', start: 0, end: 3, commentIds: [], resolvedOnly: false }]);
  });

  it('separates comments whose passage is cut in this version', () => {
    expect(commentRangesFor('answer:q1', 5, 6, state.comments)).toEqual({ ranges: [{ id: 1, start: 0, end: 3, resolved: false }], hidden: [2] });
    expect(commentRangesFor('answer:q1', 6, 6, state.comments)).toEqual({ ranges: [], hidden: [] });
  });

  it('only accepts a selection that matches the stored passage', () => {
    expect(validateSelection('Sunday morning', 7, 'morning')).toBe(true);
    expect(validateSelection('Sunday morning', 6, 'morning')).toBe(false);
    expect(validateSelection('Sunday morning', 0, '  ')).toBe(false);
  });
});

describe('queue', () => {
  const row = (id: number, status: CareQueueItem['status'], assessmentStatus: string, arrivedAt: string | null, extra: Partial<CareQueueItem> = {}): CareQueueItem =>
    ({ id, patientId: id, patientName: `Patient ${id}`, age: null, gender: null, chiefComplaint: 'Cough', status, arrivedAt, seenAt: null, departedAt: extra.departedAt ?? null, assessmentStatus, ...extra });

  it('groups in arrival order and picks who has waited longest', () => {
    const items = [
      row(1, 'ADMITTED', 'complete', '2026-10-03T14:20:00Z', { urgency: { level: 'escalate', sentence: 'Escalate' } }),
      row(2, 'ADMITTED', 'complete', '2026-10-03T14:05:00Z'),
      row(3, 'ADMITTED', 'in_progress', '2026-10-03T14:00:00Z'),
      row(4, 'CARE', 'complete', '2026-10-03T13:00:00Z'),
      row(5, 'COMPLETE', 'complete', '2026-10-03T12:00:00Z', { departedAt: '2026-10-03T12:30:00Z' }),
    ];
    expect(queueGroups(items).map((group) => [group.key, group.rows.map((item) => item.id)])).toEqual([['ready', [2, 1]], ['assessment', [3]], ['active', [4]], ['completed', [5]]]);
    expect(nextReady(items)?.id).toBe(2);
    expect(queueGroups(items, 'patient 3').flatMap((group) => group.rows.map((item) => item.id))).toEqual([3]);
  });

  it('describes tones and waits plainly', () => {
    expect(urgencyTone('escalate')).toBe('red');
    expect(urgencyTone(null)).toBe('grey');
    expect(waitWords(1)).toBe('1 minute');
    expect(waitWords(130)).toBe('2 hours');
    expect(patientMeta(34, 'F')).toBe('34, female');
  });

  it('gives each row one status, emergency warnings first', () => {
    expect(queueStatus(row(1, 'ADMITTED', 'complete', null, { emergency: { shown: true, acknowledged: true }, urgency: { level: 'escalate', sentence: '' }, redFlagCount: 2 })))
      .toEqual({ tone: 'red', text: 'Continued past an emergency warning', detail: '2 red flags reported' });
    expect(queueStatus(row(1, 'ADMITTED', 'emergency_ack_required', null, { emergency: { shown: true, acknowledged: false } })).text).toBe('Shown an emergency warning');
    expect(queueStatus(row(1, 'ADMITTED', 'complete', null, { urgency: { level: 'caution', sentence: '' }, redFlagCount: 1 }))).toEqual({ tone: 'amber', text: 'Caution', detail: '1 red flag reported' });
    expect(queueStatus(row(1, 'ADMITTED', 'complete', null)).text).toBe('Assessment finished');
    expect(queueStatus(row(1, 'ADMITTED', 'in_progress', null)).tone).toBe('blue');
    expect(queueStatus(row(1, 'ADMITTED', 'not_started', null)).text).toBe('Hasn’t started the assessment');
  });
});

describe('finish and chart text', () => {
  it('lists what is still open before the note locks', () => {
    expect(finishChecklist(state, true).map((item) => item.text)).toEqual(['Note saved, version 4', '1 comment is still open', '1 of your questions isn’t marked addressed']);
    expect(finishChecklist(state, false)[0]).toMatchObject({ tone: 'red' });
  });

  it('labels whose words each block holds, in a fixed order', () => {
    const text = composeChart(state, normalizeSnapshot(v2), ['note', 'visit', 'before']);
    expect(text.indexOf('Visit\n')).toBe(0);
    expect(text).toContain('Reason for visit (patient’s words): Sore throat');
    expect(text).toContain('Before you go in (generated by Priage, review against the answers)');
    expect(text).toContain('\nCaution: worth checking early in the visit\n');
    expect(text.trim().endsWith('Subjective\nSore throat.')).toBe(true);
    expect(text).not.toContain('AI text');
  });
});

describe('quoting and copying', () => {
  it('quotes into the note with whose words they are', () => {
    expect(quoteForNote({ id: 'answer:q1', kind: 'answer', text: 'x', voice: 'patient' }, ' since Sunday ')).toBe('Patient: “since Sunday”');
    expect(quoteForNote({ id: 'gap:0', kind: 'gap', text: 'x', voice: 'generated' }, 'gap')).toBe('Priage (generated): “gap”');
    expect(quoteForNote(undefined, 'plain')).toBe('“plain”');
    expect(appendToNote('', 'A')).toBe('A\n');
    expect(appendToNote('Note\n\n', 'A')).toBe('Note\nA\n');
  });

  it('records copies under the section the passage belongs to', () => {
    expect(copySectionFor('summary:case', { id: 'summary:case', kind: 'case', text: '', section: 'summary' })).toBe('assessment_section');
    expect(copySectionFor('summary:briefing', { id: 'summary:briefing', kind: 'briefing', text: '', section: 'summary' })).toBe('before_you_go_in');
    expect(copySectionFor('ask:0', { id: 'ask:0', kind: 'ask', text: '', section: 'ask_in_room' })).toBe('ask_in_room');
    expect(copySectionFor('answer:q1', undefined)).toBe('question_answer');
    expect(copySectionFor('summary:briefing', undefined)).toBe('assessment_section');
  });
});

describe('asked in the room and feedback', () => {
  it('writes an asked question and answer as the clinician’s own record', () => {
    expect(askLineForNote(' Any shortness of breath? ', ' Only on stairs ')).toBe('Asked in the room: Any shortness of breath?\nThey said: Only on stairs');
  });

  it('keeps only feedback on the snapshot being read', () => {
    const item = (snapshotId: number, targetKey: string) => ({ snapshotId, targetKey, segmentId: targetKey, sectionKey: 'gaps', kind: 'USEFUL' as const, note: null, updatedAt: '' });
    const map = feedbackFor([item(1, 'gap:0'), item(2, 'gap:0'), item(2, 'gap:1')], 2);
    expect([...map.keys()]).toEqual(['gap:0', 'gap:1']);
    expect(feedbackFor(undefined, 2).size).toBe(0);
  });
});

describe('clinic questions', () => {
  it('says which version was asked and when', () => {
    expect(clinicQuestionsAside(null)).toBe('Your clinic’s questions');
    expect(clinicQuestionsAside({ versionId: 4, version: 3, timing: 'in_interview', submittedAt: null, fedToInterview: true })).toBe('Version 3, asked right after the safety question');
    expect(clinicQuestionsAside({ versionId: 5, version: 4, timing: 'after_interview', submittedAt: null, fedToInterview: false })).toBe('Version 4, answered after the assessment');
    expect(normalizeSnapshot(v1).questionnaire).toBeNull();
  });
});

describe('passage locations', () => {
  it('maps passages to the tab that shows them', async () => {
    const { tabForSegment } = await import('./careModel');
    expect(['answer:q1', 'why:q1', 'unasked-why:u1', 'gap:0', 'risk:0', 'summary:case', 'visit:note', 'urgency:reason:0', 'ask:0:why'].map(tabForSegment))
      .toEqual(['answers', 'answers', 'answers', 'gaps', 'gaps', 'summary', 'visit', null, null]);
  });
});
