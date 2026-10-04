import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { CaseSeed } from '../src/modules/assessment/case/case-builder';
import type { Case } from '../src/modules/assessment/case/types';
import { advanceAssessment, createAssessment, nextQuestion, type FlowContext, type HarnessAdvance } from '../src/modules/assessment/harness/harness-flow';
import { toAssessmentClientState } from '../src/modules/assessment/harness/harness-state';
import type { HarnessState } from '../src/modules/assessment/harness/harness-types';
import { DEFAULT_CLINIC_QUESTIONS, toInterviewQuestions } from '../src/modules/clinic/questionnaire/clinic-questionnaire';
import { SAFETY_GATE_PUBLIC_ID, type ClinicQuestionnairePin } from '../src/modules/intake/interview/triage-interview.types';
import { communication, pack, seed } from './assessment-fixtures';

const ctx: FlowContext = { pack, roundSize: 3, now: () => new Date('2026-10-04T15:00:00.000Z') };
const pin: ClinicQuestionnairePin = { versionId: 4, version: 2, questions: toInterviewQuestions(DEFAULT_CLINIC_QUESTIONS) };

interface Run { state: HarnessState; case: Case }

function start(overrides: Partial<CaseSeed> = {}, clinicQuestionnaire: ClinicQuestionnairePin | null = null, budget = 15): Run {
  return createAssessment({ interviewPublicId: 'intr_test', seed: seed(overrides), clinicQuestionnaire, packId: 'unclear', budget, minQuestions: 3, modelQuestions: 'off' }, ctx);
}

function step(run: Run, dto: HarnessAdvance): Run & { completed: boolean; unchanged: boolean } {
  const turn = advanceAssessment(run.state, run.case, dto, ctx);
  return { state: turn.state, case: turn.case, completed: turn.completed, unchanged: turn.unchanged };
}

const key = (run: Run) => run.state.currentQuestion?.publicId.replace(/^hq_/, '') ?? null;

/** A plausible answer for any question, keyed by bank id. */
function answerFor(run: Run, overrides: Record<string, HarnessAdvance> = {}): HarnessAdvance {
  const question = run.state.currentQuestion!;
  const id = key(run)!;
  const base = overrides[id] ?? (() => {
    switch (question.inputType) {
      case 'boolean': return { valueBoolean: false };
      case 'duration': return { valueDuration: { amount: 2, unit: 'days' } };
      case 'scale': return { valueNumber: 4 };
      case 'single_select': return { valueChoice: question.choices[0] };
      case 'multi_select': return { valueChoices: [question.noneLabel] };
      default: return { valueText: 'none' };
    }
  })();
  return { questionPublicId: question.publicId, ...base };
}

function runToReview(run: Run, overrides: Record<string, HarnessAdvance> = {}): { run: Run; asked: string[] } {
  const asked: string[] = [];
  let current = run;
  for (let guard = 0; guard < 40 && current.state.status === 'in_progress'; guard += 1) {
    asked.push(key(current)!);
    current = step(current, answerFor(current, overrides));
  }
  return { run: current, asked };
}

describe('harness flow', () => {
  it('asks the safety question, then the clinic’s questions without counting them, then rounds from the bank', () => {
    let run = start({}, pin);
    expect(run.state.currentQuestion).toMatchObject({ publicId: SAFETY_GATE_PUBLIC_ID, source: 'safety', prompt: 'Are you in immediate danger right now?' });
    run = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    expect(run.state.currentQuestion).toMatchObject({ publicId: 'clinic:travel_14d', source: 'clinic' });
    run = step(run, { questionPublicId: 'clinic:travel_14d', valueBoolean: false });
    expect(run.state.askedCount).toBe(0);
    expect(key(run)).toBe('u.onset');
    expect(run.state.harness).toMatchObject({ round: 1, roundType: 'clarify' });
    expect(run.state.harness.queue.map((question) => question.key)).toEqual(['u.severity', 'u.course']);
  });

  it('runs the leg example from the bank to the budget, keeping the last question for "anything else?"', () => {
    let run = start();
    run = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    const { run: done, asked } = runToReview(run, { 'u.recent_events': { valueChoices: ['An injury or fall'] } });
    expect(asked).toEqual([
      'u.onset', 'u.severity', 'u.course',
      's.fever_unwell', 's.leg_swelling', 's.neck_light', 's.pain_proportion',
      'u.location', 'u.character', 'u.medications', 'u.allergies', 'u.conditions', 'u.associated', 'u.tried',
      'u.anything_else',
    ]);
    expect(done.state).toMatchObject({ status: 'review', askedCount: 15, currentQuestion: null });
    expect(done.state.harness.stopReason).toBe('budget');
    expect(done.case.candidates.find((candidate) => candidate.id === 'necrotizing_fasciitis')).toMatchObject({ status: 'not_supported' });
  });

  it('stops early when the case is done, asking the closing question last', () => {
    let run = start({ complaint: 'Paperwork for work' }, null, 30);
    run = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    const { run: done, asked } = runToReview(run);
    expect(asked.at(-1)).toBe('u.anything_else');
    expect(asked).not.toContain('u.pregnancy');
    expect(done.state.harness.stopReason).toBe('case_done');
  });

  it('shows the emergency warning for a Yes to the safety question or an emergency screen, then carries on', () => {
    let run = start({}, pin);
    run = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: true });
    expect(run.state).toMatchObject({ status: 'emergency_ack_required', currentQuestion: null });
    expect(run.state.emergencyAlert).toMatchObject({ triggerQuestionId: SAFETY_GATE_PUBLIC_ID, reason: 'Answered Yes to the immediate danger question.' });
    expect(() => step(run, { questionPublicId: 'clinic:travel_14d', valueBoolean: false })).toThrow(BadRequestException);
    run = step(run, { action: 'acknowledge_emergency' });
    expect(run.state).toMatchObject({ status: 'in_progress', emergencyAcknowledged: true });
    expect(key(run)).toBe('clinic:travel_14d');

    let cough = start({ complaint: 'Cough and chest tightness', patient: { age: 50, sex: 'male' } });
    cough = step(cough, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    for (let i = 0; i < 3; i += 1) cough = step(cough, answerFor(cough));
    while (key(cough) !== 's.breathing') cough = step(cough, answerFor(cough));
    cough = step(cough, { questionPublicId: 'hq_s.breathing', valueBoolean: true });
    expect(cough.state.status).toBe('emergency_ack_required');
    expect(cough.state.emergencyAlert?.reason).toBe('Answered “Yes” to “Are you struggling to breathe right now, even when resting?”.');
    cough = step(cough, { action: 'acknowledge_emergency' });
    // The answer supports a dangerous cause, so the round ended and the next one is a danger round about it.
    expect(cough.state.harness.roundType).toBe('danger');
    expect(cough.case.candidates.find((candidate) => candidate.id === 'pulmonary_embolism')).toMatchObject({ status: 'possible' });
    expect(key(cough)).toBe('s.chest');
  });

  it('asks one gentle follow-up after a vague text answer', () => {
    let run = start({ complaint: 'Paperwork for work' });
    run = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    while (key(run) !== 'u.location') run = step(run, answerFor(run));
    run = step(run, { questionPublicId: 'hq_u.location', valueText: 'idk' });
    expect(run.state.currentQuestion).toMatchObject({ publicId: 'hq_fu.1', source: 'follow_up', prompt: 'You answered “idk”. Could you tell us a little more?', allowNotSure: true });
    run = step(run, { questionPublicId: 'hq_fu.1', valueText: 'not sure' });
    expect(run.state.currentQuestion?.source).not.toBe('follow_up');
    expect(run.case.followedUp).toEqual(['hq_u.location']);
  });

  it('treats an identical retry as a no-op and rejects a different answer to a stale question', () => {
    let run = start();
    run = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    const retry = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    expect(retry.unchanged).toBe(true);
    expect(() => step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: true })).toThrow('Interview answer does not match the active question.');
    expect(() => step(run, { questionPublicId: 'hq_u.onset', valueText: 'two days' })).toThrow('An answer is required to continue.');
    expect(() => step(run, { questionPublicId: 'hq_u.onset', valueDuration: { amount: 2, unit: 'fortnights' } })).toThrow(BadRequestException);
    expect(step(run, { action: 'acknowledge_emergency' }).unchanged).toBe(true);
    expect(() => step(run, { action: 'confirm_review' })).toThrow('Your answers aren’t ready to check yet.');
  });

  it('lets the patient correct answers at review, keeping the original, then confirm', () => {
    let run = start();
    run = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    run = runToReview(run).run;
    const client = toAssessmentClientState(run.state);
    expect(client.harness.review?.[0]).toMatchObject({ questionPublicId: SAFETY_GATE_PUBLIC_ID, canChange: false });
    expect(client.harness.review?.find((item) => item.questionPublicId === 'hq_u.severity')).toMatchObject({ answer: '4', canChange: true });

    expect(() => step(run, { action: 'correct_answer', questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: true })).toThrow('The safety question can’t be changed here.');
    expect(() => step(run, { action: 'correct_answer', questionPublicId: 'hq_nope', valueBoolean: true })).toThrow(BadRequestException);
    expect(step(run, { action: 'correct_answer', questionPublicId: 'hq_u.severity', valueNumber: 4 }).unchanged).toBe(true);

    run = step(run, { action: 'correct_answer', questionPublicId: 'hq_u.severity', valueNumber: 8 });
    const correction = run.state.answers.at(-1)!;
    expect(correction).toMatchObject({ answerId: 'hq_u.severity:correction:1', correctionOf: 'hq_u.severity', answerText: '8' });
    expect(run.state.answers.filter((answer) => answer.questionPublicId === 'hq_u.severity')).toHaveLength(2);
    expect(toAssessmentClientState(run.state).harness.review?.find((item) => item.questionPublicId === 'hq_u.severity')?.answer).toBe('8');
    expect(run.state.status).toBe('review');
    expect(() => step(run, { questionPublicId: 'hq_u.severity', valueNumber: 2 })).toThrow('Your answers are ready to check.');

    const confirmed = step(run, { action: 'confirm_review' });
    expect(confirmed).toMatchObject({ completed: true });
    expect(confirmed.state.status).toBe('complete');
    expect(step(confirmed, { action: 'confirm_review' }).unchanged).toBe(true);
    expect(() => step(confirmed, { questionPublicId: 'hq_u.onset', valueBoolean: true })).toThrow(BadRequestException);
  });

  it('shows a warning raised by a correction, then returns to the review', () => {
    let run = start({ complaint: 'Headache since this morning', patient: { age: 40, sex: 'female' } });
    run = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    run = runToReview(run).run;
    run = step(run, { action: 'correct_answer', questionPublicId: 'hq_s.thunderclap', valueBoolean: true });
    expect(run.state.status).toBe('emergency_ack_required');
    run = step(run, { action: 'acknowledge_emergency' });
    expect(run.state.status).toBe('review');
  });

  it('serves French wording for a child, stores English, and maps French choices back', () => {
    let run = start({ complaint: 'Mal de ventre', patient: { age: 6, sex: 'female' }, communication: communication({ language: 'fr', answeredBy: 'parent', subjectAge: 6 }) });
    expect(run.state.currentQuestion?.prompt).toBe('Votre enfant est-il en danger immédiat en ce moment?');
    run = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    run = step(run, { questionPublicId: 'hq_u.onset', valueDuration: { amount: 3, unit: 'days' } });
    run = step(run, { questionPublicId: 'hq_u.severity', notSure: true });
    expect(run.state.currentQuestion).toMatchObject({ prompt: 'Depuis le début, comment cela a-t-il changé chez votre enfant?', choices: expect.arrayContaining(['Ça empire lentement']) });
    run = step(run, { questionPublicId: 'hq_u.course', valueChoice: 'Ça empire lentement' });
    const [onset, severity, course] = run.state.answers.slice(1);
    expect(onset).toMatchObject({ prompt: 'How long ago did this start for your child?', answerText: '3 days ago', originalText: 'il y a 3 jours', language: 'fr', answeredBy: 'parent', bankKey: 'urgent.timeline' });
    expect(severity).toMatchObject({ answerText: 'Not sure', originalText: 'Je ne sais pas', notSure: true });
    expect(course).toMatchObject({ answerText: 'Getting worse slowly', valueChoice: 'Getting worse slowly', originalText: 'Ça empire lentement', displayPrompt: 'Depuis le début, comment cela a-t-il changé chez votre enfant?' });
  });

  it('never sends the plan, English keys, or possible causes to the patient', () => {
    let run = start();
    run = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    run = runToReview(run).run;
    const client = JSON.stringify(toAssessmentClientState(run.state));
    for (const leak of ['"plan"', '"choiceKeys"', '"englishPrompt"', 'necrotizing_fasciitis', 'dvt', 'sepsis', 'meningitis', '"targets"']) expect(client).not.toContain(leak);
    expect(toAssessmentClientState(run.state).cachedQuestions).toEqual([]);
  });

  it('resumes by serving the next question when none is showing', () => {
    let run = start();
    run = step(run, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    const blank = { ...run.state, currentQuestion: null };
    expect(nextQuestion(blank, run.case, ctx).state.currentQuestion?.publicId).toBe('hq_u.onset');
    const via = step({ state: blank, case: run.case }, {});
    expect(key(via)).toBe('hq_u.onset'.replace('hq_', ''));
    expect(() => step({ state: blank, case: run.case }, { questionPublicId: 'hq_u.onset', valueDuration: { amount: 1, unit: 'days' } })).toThrow('Interview answer does not match the active question.');
  });
});
