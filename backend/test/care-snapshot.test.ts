import { describe, expect, it } from 'vitest';

import { buildCareSnapshotContentV2, isSnapshotV2, queueHandoffSummary, type SnapshotBuildInput } from '../src/modules/clinic/care/care-snapshot';
import { deriveEmergencyEvents, emergencyMarker } from '../src/modules/clinic/care/emergency-events';
import { RESCUE_QUESTION_BANK } from '../src/modules/intake/interview/rescue-question-bank';
import { SAFETY_GATE_PUBLIC_ID } from '../src/modules/intake/interview/triage-interview.types';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 3, 14, minute));
const question = (publicId: string, draft: { prompt: string; phase: string; inputType: string; clinicalReason: string }) => ({ publicId, ...draft });
const safetyQuestion = { publicId: SAFETY_GATE_PUBLIC_ID, prompt: 'Are you in immediate danger right now?', phase: 'urgent', inputType: 'boolean', clinicalReason: 'Immediate life-threatening check.' };
const timeline = question('q1', RESCUE_QUESTION_BANK.urgent[0]);
const screen = question('q2', RESCUE_QUESTION_BANK.urgent[2]);
const activity = question('q3', RESCUE_QUESTION_BANK.emergent[2]);

function answerRecord(q: { publicId: string; prompt: string; phase: string; inputType: string }, answerText: string, minute: number) {
  return {
    questionPublicId: q.publicId, prompt: q.prompt, phase: q.phase, inputType: q.inputType, answeredAt: at(minute).toISOString(), answerText,
    ...(q.inputType === 'boolean' ? { valueBoolean: answerText === 'Yes' } : {}),
  };
}

function build(overrides: Partial<SnapshotBuildInput> = {}) {
  const answers = [answerRecord(safetyQuestion, 'No', 1), answerRecord(timeline, 'Sunday morning', 2), answerRecord(screen, 'No', 3)];
  return buildCareSnapshotContentV2({
    states: [
      { createdAt: at(0), payload: { status: 'in_progress', currentQuestion: safetyQuestion, cachedQuestions: [], pendingCandidates: [] } },
      { createdAt: at(1), payload: { status: 'in_progress', currentQuestion: timeline, cachedQuestions: [screen, activity], pendingCandidates: [] } },
      // The engine regenerated the screen question with a new id; it was answered under q2.
      { createdAt: at(2), payload: { status: 'in_progress', currentQuestion: screen, cachedQuestions: [{ ...screen, publicId: 'q2-regenerated' }], pendingCandidates: [] } },
      { createdAt: at(3), payload: { status: 'complete', askedCount: 2, maxQuestions: 12, generationMode: 'fallback', governance: { version: 'gov-1', provider: { name: 'deterministic' } }, answers } },
    ],
    answerItems: answers.map((payload) => ({ payload, answerEntryMode: 'PATIENT_SELF', enteredByUserId: null })),
    projection: { createdAt: at(4), content: { briefing: 'Patient reports x, with current intake urgency low and provisional AI CTAS 4.', caseSummary: 'Engine summary', generatedAt: at(4).toISOString() } },
    patientIntake: { chiefComplaint: 'Sore throat', details: 'Started Sunday, worse at night.' },
    encounterComplaint: 'Sore throat',
    patient: { age: 34, gender: 'F', allergies: 'Penicillin', conditions: null },
    complete: true,
    ...overrides,
  });
}

describe('care snapshot v2', () => {
  it('keeps every v1 field so the existing UI still renders', () => {
    const content = build();
    expect(isSnapshotV2(content)).toBe(true);
    expect(content.summary).toMatchObject({ briefing: expect.any(String), caseSummary: expect.any(String), recommendedAction: 'No high-risk answers. Routine visit.', redFlags: [], progressionRisks: [] });
    expect(content.interviewStatus).toBe('complete');
    expect(content.governance).toEqual({ version: 'gov-1', decisionSupportOnly: true, humanReviewRequired: true });
    expect(content.handoffGenerator.kind).toBe('deterministic');
  });

  it('never carries CTAS from the engine briefing', () => {
    expect(JSON.stringify(build())).not.toMatch(/ctas/i);
  });

  it('labels where each answer came from, its stage and why it was asked', () => {
    const content = build();
    expect(content.answers.map((answer) => [answer.questionId, answer.source, answer.stage])).toEqual([
      [SAFETY_GATE_PUBLIC_ID, 'safety', null],
      ['q1', 'ai', 'red_flag_screen'],
      ['q2', 'ai', 'red_flag_screen'],
    ]);
    expect(content.answers[1].why).toBe(RESCUE_QUESTION_BANK.urgent[0].clinicalReason);
  });

  it('lists planned questions that were never asked, without regenerated copies of answered ones', () => {
    const content = build();
    expect(content.unasked.map((item) => item.questionId)).toEqual(['q3']);
    expect(content.unasked[0]).toMatchObject({ stage: 'narrowing', clinicalReason: RESCUE_QUESTION_BANK.emergent[2].clinicalReason });
  });

  it('takes the patient note from their own words, not the encounter record', () => {
    const content = build();
    expect(content.visitRecord).toEqual({ chiefComplaint: 'Sore throat', patientNote: 'Started Sunday, worse at night.', allergies: 'Penicillin', conditions: null });
    expect(content.segments.find((segment) => segment.id === 'visit:note')).toMatchObject({ voice: 'patient', section: 'visit_record' });
  });

  it('gives every passage a unique id and every reference a real passage', () => {
    const content = build({ states: [{ createdAt: at(0), payload: { status: 'in_progress', askedCount: 1, maxQuestions: 12 } }], complete: false });
    const ids = content.segments.map((segment) => segment.id);
    expect(new Set(ids).size).toBe(ids.length);
    const refs = [
      ...content.urgency.reasons.flatMap((reason) => reason.refs),
      ...content.redFlags.flatMap((flag) => flag.refs),
      ...content.askInRoom.flatMap((item) => item.basedOn),
      ...content.gaps.flatMap((gap) => gap.refs),
      ...content.nextSteps.flatMap((step) => step.refs),
    ];
    for (const ref of refs) expect(ids).toContain(ref);
    expect(content.urgency.sentence).toMatch(/unfinished assessment$/);
  });

  it('tags voices so only generated text can take feedback', () => {
    const voices = Object.fromEntries(build().segments.map((segment) => [segment.id, segment.voice]));
    expect(voices['summary:briefing']).toBe('generated');
    expect(voices['answer:q1']).toBe('patient');
    expect(voices['question:q1']).toBe('record');
    expect(voices['why:q1']).toBe('generated');
  });
});

describe('clinic questions in the snapshot', () => {
  const travelQuestion = { publicId: 'clinic:travel_14d', prompt: 'Have you travelled outside Canada in the last 14 days?', phase: 'urgent', inputType: 'boolean', clinicalReason: 'Your clinic asks this of every patient.' };
  const pin = { versionId: 40, version: 3, questions: [travelQuestion] };

  it('labels answers asked in the interview as the clinic’s, after the safety answer', () => {
    const answers = [answerRecord(safetyQuestion, 'No', 1), answerRecord(travelQuestion, 'Yes', 2), answerRecord(timeline, 'Sunday morning', 3)];
    const content = build({
      states: [
        { createdAt: at(0), payload: { status: 'in_progress', currentQuestion: safetyQuestion, clinicQuestionnaire: pin } },
        { createdAt: at(1), payload: { status: 'in_progress', currentQuestion: travelQuestion, clinicQuestionnaire: pin } },
        { createdAt: at(3), payload: { status: 'complete', askedCount: 1, maxQuestions: 12, generationMode: 'fallback', clinicQuestionnaire: pin, answers } },
      ],
      answerItems: answers.map((payload) => ({ payload, answerEntryMode: 'PATIENT_SELF', enteredByUserId: null })),
    });
    expect(content.answers.map((answer) => [answer.questionId, answer.source, answer.stage, answer.why])).toEqual([
      [SAFETY_GATE_PUBLIC_ID, 'safety', null, 'Immediate life-threatening check.'],
      ['clinic:travel_14d', 'clinic', null, null],
      ['q1', 'ai', 'red_flag_screen', null],
    ]);
    expect(content.segments.find((segment) => segment.id === 'answer:clinic:travel_14d')).toMatchObject({ voice: 'patient', section: 'questionnaire' });
    expect(content.questionnaire).toMatchObject({ versionId: 40, version: 3, timing: 'in_interview', fedToInterview: true });
    expect(content.askInRoom.map((item) => item.ruleId)).toContain('ask.clinic.travel');
    expect(content.unasked.some((item) => item.questionId.startsWith('clinic:'))).toBe(false);
  });

  it('places answers given after the interview where the interview would have asked them', () => {
    const response = { versionId: 41, version: 4, answers: [answerRecord(travelQuestion, 'No', 9)] };
    const content = build({ clinicResponse: { payload: response, createdAt: at(9) }, clinicQuestionsExpected: true });
    expect(content.answers.map((answer) => answer.questionId).slice(0, 2)).toEqual([SAFETY_GATE_PUBLIC_ID, 'clinic:travel_14d']);
    expect(content.questionnaire).toMatchObject({ versionId: 41, timing: 'after_interview', fedToInterview: false, submittedAt: at(9).toISOString() });
    expect(content.gaps.map((gap) => gap.kind)).not.toContain('clinic_questions_missing');
  });

  it('notes when the clinic expected answers that never came', () => {
    expect(build({ clinicQuestionsExpected: true }).gaps.map((gap) => gap.kind)).toContain('clinic_questions_missing');
    expect(build().questionnaire).toBeNull();
  });
});

describe('emergency events', () => {
  it('reads shown and continued times from the state chain', () => {
    const events = deriveEmergencyEvents([
      { createdAt: at(5), payload: { status: 'in_progress', emergencyAcknowledged: true } },
      { createdAt: at(1), payload: { status: 'emergency_ack_required', emergencyAlert: { title: 'Get emergency help now', body: 'Call 911.', recommendation: '', reason: 'Answered Yes to the immediate danger question.', triggerQuestionId: SAFETY_GATE_PUBLIC_ID } } },
      { createdAt: at(8), payload: { status: 'emergency_ack_required', emergencyAlert: { title: 'Model warning', body: '', recommendation: '' }, answers: [{ questionPublicId: 'q7' }] } },
    ]);
    expect(events).toEqual([
      { id: 'emergency-0', trigger: 'safety_gate', triggerQuestionId: SAFETY_GATE_PUBLIC_ID, title: 'Get emergency help now', body: 'Call 911.', reason: 'Answered Yes to the immediate danger question.', shownAt: at(1).toISOString(), acknowledgedAt: at(5).toISOString() },
      { id: 'emergency-1', trigger: 'model_interrupt', triggerQuestionId: 'q7', title: 'Model warning', body: '', reason: null, shownAt: at(8).toISOString(), acknowledgedAt: null },
    ]);
  });

  it('marks queue rows from the current state', () => {
    expect(emergencyMarker({ status: 'emergency_ack_required' })).toEqual({ shown: true, acknowledged: false });
    expect(emergencyMarker({ status: 'complete', emergencyAcknowledged: true })).toEqual({ shown: true, acknowledged: true });
    expect(emergencyMarker({ status: 'complete' })).toBeNull();
    expect(emergencyMarker(undefined)).toBeNull();
  });
});

describe('queue summary', () => {
  it('summarizes a row from the current state alone', () => {
    const summary = queueHandoffSummary({
      state: { status: 'complete', askedCount: 2, maxQuestions: 12, answers: [answerRecord(safetyQuestion, 'Yes', 1)] },
      patientIntake: null,
      encounterComplaint: 'Chest pain',
      patient: { age: 60, gender: 'M', allergies: null, conditions: null },
    });
    expect(summary).toMatchObject({ urgency: { level: 'escalate' }, redFlagCount: 2 });
    expect(queueHandoffSummary({ state: null, patientIntake: null, encounterComplaint: null, patient: { age: null, gender: null, allergies: null, conditions: null } })).toBeNull();
  });
});
