import { describe, expect, it } from 'vitest';

import { causeTerms } from '../src/modules/assessment/case/audit';
import { applyRound } from '../src/modules/assessment/case/case-builder';
import { deterministicRound, mostImportantOpenItem, openItems } from '../src/modules/assessment/case/deterministic-planner';
import { checkQuestion } from '../src/modules/assessment/case/question-checks';
import { aboutSupportedDanger, selectQuestions } from '../src/modules/assessment/case/selection';
import { askableLimitReached, chooseRoundType, coreHistorySettled, stopRule, type StopContext } from '../src/modules/assessment/case/stop-rule';
import type { Candidate, Case, PlannedQuestion } from '../src/modules/assessment/case/types';
import { elementsFilled, passesValueTest } from '../src/modules/assessment/case/value-test';
import { answer, bankQuestion, modelQuestion, pack, startCase } from './assessment-fixtures';

function withCandidates(current: Case, candidates: Candidate[]): Case {
  return { ...current, candidates };
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return { id: 'other:bruise', label: 'Bruise', tier: 'routine', status: 'possible', for: ['visit:complaint'], against: [], askableNext: ['ask'], needsInPerson: [], addedBy: 'model', ...overrides };
}

const stop = (overrides: Partial<StopContext> = {}): StopContext => ({ coreHistory: pack.coreHistory, askedCount: 5, budget: 15, minQuestions: 3, ...overrides });

describe('question checks', () => {
  const current = withCandidates(startCase(), [candidate()]);
  const terms = causeTerms(pack, current.candidates);
  const check = (question: PlannedQuestion, allowLongText = false) => checkQuestion(question, { current, causeTerms: terms, allowLongText });

  it('passes a plain, one-idea model question about known targets', () => {
    expect(check(modelQuestion())).toEqual([]);
  });

  it('rejects empty, long, double, cause-naming and advising questions', () => {
    expect(check(modelQuestion({ text: '  ' }))).toEqual(['empty']);
    expect(check(modelQuestion({ text: `${'Is it '.repeat(30)}sore?` }))).toContain('too_long');
    expect(check(modelQuestion({ text: 'Is it red? Is it hot?' }))).toContain('multiple_ideas');
    expect(check(modelQuestion({ text: 'Have you been told you have a DVT?' }))).toContain('names_cause');
    expect(check(modelQuestion({ text: 'Do you think this is a bruise?' }))).toContain('names_cause');
    expect(check(modelQuestion({ text: 'Don’t worry, is it only a little sore?' }))).toContain('advice');
  });

  it('rejects repeats by key, text, same element and targets, or a settled element', () => {
    let asked = answer(current, modelQuestion(), { valueBoolean: true }, 'a1');
    expect(checkQuestion(modelQuestion({ key: 'other' }), { current: asked, causeTerms: [] })).toContain('repeat');
    expect(checkQuestion(modelQuestion({ key: 'm2', text: 'Did anything hit or injure your leg in the last week' }), { current: asked, causeTerms: [] })).toContain('repeat');
    asked = answer(asked, bankQuestion('u.medications'), { valueText: 'none' }, 'a2');
    const meds = modelQuestion({ key: 'm3', text: 'Which pills do you take each day?', format: 'text', element: 'medications', targets: ['medications'], ifAnswered: [] });
    expect(checkQuestion(meds, { current: asked, causeTerms: [] })).toContain('repeat');
    const sameElement = modelQuestion({ key: 'm4', text: 'Anything you take for it?', format: 'text', element: 'tried_so_far', targets: ['tried_so_far'], ifAnswered: [] });
    const triedOnce = answer(asked, bankQuestion('u.tried'), { valueText: 'ice' }, 'a3');
    expect(checkQuestion(sameElement, { current: { ...triedOnce, history: {} }, causeTerms: [] })).toContain('repeat');
  });

  it('checks the format, long text, choices, targets and outcomes', () => {
    expect(check(modelQuestion({ format: 'body_map' as never }))).toContain('format');
    expect(check(modelQuestion({ format: 'textarea', ifAnswered: [] }))).toContain('long_text');
    expect(check(modelQuestion({ format: 'textarea', ifAnswered: [] }), true)).toEqual([]);
    const single = (choices: string[]) => modelQuestion({ format: 'single_select', choices, ifAnswered: choices.map((choice) => ({ answer: choice, effects: [] })) });
    expect(check(single(['Only one']))).toContain('choices');
    expect(check(single(['Yes', 'yes']))).toContain('choices');
    expect(check(single(['Hours', 'Not sure']))).toContain('choices');
    expect(check(single(['Hours', '']))).toContain('choices');
    expect(check(single(['Hours', 'Days']))).toEqual([]);
    expect(check(modelQuestion({ format: 'single_select', choices: ['Hours', 'Days'], ifAnswered: [{ answer: 'Hours', effects: [] }] }))).toContain('outcomes');
    expect(check(modelQuestion({ ifAnswered: [{ answer: 'Yes', effects: [] }] }))).toContain('outcomes');
    expect(check(modelQuestion({ targets: ['other:unknown'] }))).toContain('unknown_target');
    expect(check(modelQuestion({ targets: [] }))).toContain('unknown_target');
    expect(check(modelQuestion({ source: 'bank', targets: ['anything'] }))).toEqual([]);
  });
});

describe('value test', () => {
  const current = startCase();

  it('passes when answers change the case differently', () => {
    expect(passesValueTest(modelQuestion(), current)).toBe(true);
    const same = modelQuestion({ ifAnswered: [{ answer: 'Yes', effects: [{ target: 'other:bruise', shift: 'supports' }] }, { answer: 'No', effects: [{ target: 'other:bruise', shift: 'supports' }] }] });
    expect(passesValueTest(same, current)).toBe(false);
    const emergencyOnly = modelQuestion({ ifAnswered: [{ answer: 'Yes', effects: [], emergency: true }, { answer: 'No', effects: [] }] });
    expect(passesValueTest(emergencyOnly, current)).toBe(true);
  });

  it('passes when it fills a history element that isn’t settled', () => {
    const meds = bankQuestion('u.medications');
    expect(elementsFilled(meds)).toEqual(['medications']);
    expect(passesValueTest(meds, current)).toBe(true);
    expect(passesValueTest(meds, answer(current, meds, { valueText: 'none' }))).toBe(false);
    expect(elementsFilled(bankQuestion('u.pregnancy'))).toEqual(['pregnancy_possible']);
  });
});

describe('selection', () => {
  const base = withCandidates(startCase(), [
    candidate({ id: 'necrotizing_fasciitis', label: 'Flesh-eating infection', tier: 'cant_miss', status: 'possible' }),
    candidate({ id: 'dvt', label: 'Deep vein clot', tier: 'cant_miss', status: 'not_enough_information', for: [] }),
    candidate(),
    candidate({ id: 'other:cellulitis', label: 'Cellulitis' }),
  ]);
  const options = { roundType: 'distinguish' as const, remainingBudget: 10, coreHistory: pack.coreHistory, causeTerms: causeTerms(pack, base.candidates) };
  const q = (key: string, overrides: Partial<PlannedQuestion> = {}) => modelQuestion({ key, text: `Question ${key}?`, ...overrides });

  it('orders by supported danger, open danger, causes affected, missing core history, then burden', () => {
    const proposed = [
      q('low', { burden: 'medium' }),
      q('two', { targets: ['other:bruise', 'other:cellulitis'], ifAnswered: [{ answer: 'Yes', effects: [{ target: 'other:bruise', shift: 'supports' }] }, { answer: 'No', effects: [{ target: 'other:cellulitis', shift: 'supports' }] }] }),
      q('danger', { purpose: 'danger', targets: ['necrotizing_fasciitis'], group: 'g', ifAnswered: [{ answer: 'Yes', effects: [{ target: 'necrotizing_fasciitis', shift: 'supports' }] }, { answer: 'No', effects: [] }] }),
      q('easy'),
    ];
    const { chosen } = selectQuestions(proposed, base, options);
    expect(chosen.map((question) => question.key)).toEqual(['danger', 'two', 'easy', 'low']);
    expect(chosen[0].group).toBeUndefined();
    expect(aboutSupportedDanger(chosen[0], base)).toBe(true);
  });

  it('allows one off-purpose question and one danger check outside a danger round', () => {
    const dangerCheck = (key: string) => q(key, { purpose: 'danger', targets: ['dvt'], ifAnswered: [{ answer: 'Yes', effects: [{ target: 'dvt', shift: 'supports' }] }, { answer: 'No', effects: [{ target: 'dvt', shift: 'weakens' }] }] });
    const proposed = [q('a'), dangerCheck('d1'), dangerCheck('d2'), q('h1', { purpose: 'history' }), q('h2', { purpose: 'history' })];
    const result = selectQuestions(proposed, base, options);
    expect(result.chosen.map((question) => question.key)).toEqual(['d1', 'a', 'h1']);
    expect(result.notChosen.map((entry) => [entry.question.key, entry.reason])).toEqual([['d2', 'off_purpose'], ['h2', 'off_purpose']]);
  });

  it('drops failures, duplicates and no-value questions, and moves clinician questions to the room', () => {
    const proposed = [
      q('dup'), q('dup2', { text: 'Question dup?' }),
      q('bad', { text: 'Is it a DVT?' }),
      q('flat', { ifAnswered: [{ answer: 'Yes', effects: [] }, { answer: 'No', effects: [] }] }),
      q('room', { betterInRoom: '  ' }),
      q('heavy', { burden: 'high' }),
      q('room2', { betterInRoom: 'Needs the chart' }),
    ];
    const result = selectQuestions(proposed, base, options);
    expect(result.chosen.map((question) => question.key)).toEqual(['dup']);
    expect(result.notChosen.map((entry) => [entry.question.key, entry.reason])).toEqual([['dup2', 'duplicate'], ['bad', 'names_cause'], ['flat', 'no_value']]);
    expect(result.askInRoom).toEqual([
      { text: 'Question room?', reason: 'Better asked in person.', answerIds: [] },
      { text: 'Question heavy?', reason: 'Better asked in person.', answerIds: [] },
      { text: 'Question room2?', reason: 'Needs the chart', answerIds: [] },
    ]);
  });

  it('keeps to the round size and the remaining budget', () => {
    const proposed = ['a', 'b', 'c', 'd', 'e'].map((key) => q(key));
    expect(selectQuestions(proposed, base, options).chosen).toHaveLength(4);
    expect(selectQuestions(proposed, base, { ...options, roundSize: 2 }).chosen).toHaveLength(2);
    const tight = selectQuestions(proposed, base, { ...options, remainingBudget: 1 });
    expect(tight.chosen).toHaveLength(1);
    expect(tight.notChosen.every((entry) => entry.reason === 'not_selected')).toBe(true);
    expect(selectQuestions(proposed, base, { ...options, remainingBudget: 0 }).chosen).toEqual([]);
  });

  it('ranks a question that fills missing core history ahead of one that doesn’t', () => {
    const fills = q('fills', { purpose: 'history', format: 'text', element: 'onset', targets: ['onset'], ifAnswered: [] });
    const other = q('other', { purpose: 'history', format: 'text', element: 'daily_impact', targets: ['daily_impact'], ifAnswered: [] });
    expect(selectQuestions([other, fills], base, { ...options, roundType: 'history' }).chosen.map((question) => question.key)).toEqual(['fills', 'other']);
  });
});

describe('stop rule and round type', () => {
  const settled = (current: Case): Case => ({
    ...current,
    complaints: current.complaints.map((complaint) => ({ ...complaint, characterized: true })),
    history: Object.fromEntries(pack.coreHistory.map((element) => [element, { status: 'filled', evidenceIds: [] }])),
  });

  it('stops for the patient, the budget, or a finished case, never before the minimum', () => {
    const done = withCandidates(settled(startCase()), [candidate({ askableNext: [] })]);
    expect(stopRule(done, stop({ patientStopped: true }))).toBe('patient_stopped');
    expect(stopRule(done, stop({ askedCount: 15 }))).toBe('budget');
    expect(stopRule(done, stop({ askedCount: 2 }))).toBeNull();
    expect(stopRule(done, stop())).toBe('case_done');
    expect(stopRule(withCandidates(done, [candidate()]), stop())).toBeNull();
    expect(askableLimitReached(candidate({ askableNext: [] }))).toBe(true);
    expect(coreHistorySettled(startCase(), pack.coreHistory)).toBe(false);
  });

  it('chooses clarify, danger, distinguish, history, then stop', () => {
    const current = startCase();
    expect(chooseRoundType(current, stop())).toBe('clarify');
    const characterized = { ...current, complaints: current.complaints.map((complaint) => ({ ...complaint, characterized: true })) };
    expect(chooseRoundType(withCandidates(characterized, [candidate({ tier: 'cant_miss' })]), stop())).toBe('danger');
    expect(chooseRoundType(withCandidates(characterized, [candidate()]), stop())).toBe('distinguish');
    expect(chooseRoundType(withCandidates(characterized, [candidate({ status: 'not_supported' })]), stop())).toBe('history');
    const done = withCandidates(settled(current), [candidate({ askableNext: [] })]);
    expect(chooseRoundType(done, stop({ askedCount: 2 }))).toBe('history');
    expect(chooseRoundType(done, stop())).toBe('stop');
    expect(chooseRoundType(withCandidates(settled(current), [candidate({ status: 'not_supported' })]), stop())).toBe('stop');
  });
});

describe('deterministic planner', () => {
  it('asks core history first, then one screen per dangerous cause, then the rest of the core and fillers', () => {
    const current = startCase();
    expect(openItems(current, pack).map((question) => question.key)).toEqual([
      'u.onset', 'u.severity', 'u.course',
      's.fever_unwell', 's.leg_swelling', 's.neck_light', 's.pain_proportion',
      'u.location', 'u.character',
      'u.medications', 'u.allergies', 'u.conditions', 'u.associated', 'u.tried', 'u.worse_activity', 'u.recent_events', 'u.daily_impact',
    ]);
    expect(mostImportantOpenItem(current, pack)?.key).toBe('u.onset');
  });

  it('puts screens for a supported dangerous cause first and asks the pregnancy question only when it applies', () => {
    let current = answer(startCase({ complaint: 'Belly pain and spotting', patient: { age: 29, sex: 'female' } }), bankQuestion('u.pregnancy'), { valueBoolean: true }, 'a1');
    current = applyRound(current, pack, null).case;
    expect(current.candidates.find((entry) => entry.id === 'ectopic_pregnancy')).toMatchObject({ status: 'possible', askableNext: ['s.pregnancy_bleeding'] });
    expect(openItems(current, pack)[0].key).toBe('s.pregnancy_bleeding');
    const forChild = startCase({ complaint: 'Belly pain', patient: { age: 14, sex: 'female' }, communication: { language: 'en', readingLevel: 'standard', answeredBy: 'parent', subjectAge: 14, input: [] } });
    expect(openItems(forChild, pack).map((question) => question.key)).not.toContain('u.pregnancy');
  });

  it('keeps the last question of the budget for the closing question', () => {
    const current = startCase();
    expect(deterministicRound(current, pack, { roundSize: 3, remainingBudget: 10 }).map((question) => question.key)).toEqual(['u.onset', 'u.severity', 'u.course']);
    expect(deterministicRound(current, pack, { roundSize: 3, remainingBudget: 2 }).map((question) => question.key)).toEqual(['u.onset']);
    expect(deterministicRound(current, pack, { roundSize: 3, remainingBudget: 1 }).map((question) => question.key)).toEqual(['u.anything_else']);
    expect(deterministicRound(current, pack, { roundSize: 3, remainingBudget: 0 })).toEqual([]);
  });

  it('asks the closing question when nothing else is open, then nothing', () => {
    const anyAnswer = (question: PlannedQuestion) => {
      if (question.format === 'boolean') return { valueBoolean: false };
      if (question.allowNotSure) return { notSure: true };
      if (question.format === 'single_select') return { valueChoice: question.choices![0] };
      return { valueText: 'none' };
    };
    let current = startCase({ complaint: '' });
    for (const question of openItems(current, pack)) current = answer(current, question, anyAnswer(question));
    current = applyRound(current, pack, null).case;
    expect(openItems(current, pack)).toEqual([]);
    expect(mostImportantOpenItem(current, pack)?.key).toBe('u.anything_else');
    current = answer(current, bankQuestion('u.anything_else'), { valueText: 'no' });
    expect(mostImportantOpenItem(current, pack)).toBeNull();
    expect(deterministicRound(current, pack, { roundSize: 3, remainingBudget: 5 })).toEqual([]);
  });
});
