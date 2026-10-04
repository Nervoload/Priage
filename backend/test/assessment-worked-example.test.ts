import { describe, expect, it } from 'vitest';

import { normalizeAnswer } from '../src/modules/assessment/case/answers';
import { causeTerms } from '../src/modules/assessment/case/audit';
import { applyRound } from '../src/modules/assessment/case/case-builder';
import { answerSignals } from '../src/modules/assessment/case/evidence';
import { selectQuestions } from '../src/modules/assessment/case/selection';
import { chooseRoundType, stopRule, type StopContext } from '../src/modules/assessment/case/stop-rule';
import type { Case, CandidateDraft, InterpreterOutput, PlannedQuestion } from '../src/modules/assessment/case/types';
import { answer, bankQuestion, modelQuestion, pack, specFor, startCase } from './assessment-fixtures';

// The leg example from docs/AI_ASSESSMENT_HARNESS.md, with hand-written model
// outputs, run through the real rules. Illustrative, not clinically reviewed.

const draft = (label: string, status: CandidateDraft['status'], extra: Partial<CandidateDraft> = {}): CandidateDraft =>
  ({ label, tier: 'routine', status, for: [], against: [], askableNext: [], needsInPerson: [], ...extra });

const interpret = (candidates: CandidateDraft[]): InterpreterOutput => ({
  complaints: [{ id: 'leg', patientWords: 'Growing purple spot on my leg, hot, spreading fast', systems: ['skin', 'musculoskeletal'], characterized: true }],
  history: [], candidates, whatElse: 'A bite reaction or a bleeding problem could also explain it.', contradictions: [],
  escalate: { level: 'none', reason: '', answerIds: [] }, emergency: { flagged: false, reason: '', answerIds: [] }, integrity: 'ok',
});

const stopCtx = (current: Case): StopContext => ({ coreHistory: pack.coreHistory, askedCount: current.asked.length, budget: 15, minQuestions: 3 });
const choose = (current: Case, proposed: PlannedQuestion[]) => {
  const roundType = chooseRoundType(current, stopCtx(current));
  if (roundType === 'stop') throw new Error('unexpected stop');
  return { roundType, ...selectQuestions(proposed, current, { roundType, remainingBudget: 15 - current.asked.length, coreHistory: pack.coreHistory, causeTerms: causeTerms(pack, current.candidates) }) };
};
const byId = (current: Case) => Object.fromEntries(current.candidates.map((candidate) => [candidate.id, candidate]));

describe('worked example: a hot, spreading purple spot on the leg', () => {
  it('runs danger → distinguish → stop, never anchoring on one cause and never dropping a dangerous one', () => {
    // Before round 0: the patient's words, the audit, and the core facts asked while round 0 plans.
    let current = startCase();
    expect(current.auditAdded).toEqual(['sepsis', 'dvt', 'meningitis', 'necrotizing_fasciitis']);
    current = answer(current, bankQuestion('u.onset'), { valueDuration: { amount: 2, unit: 'days' } }, 'a1');
    current = answer(current, bankQuestion('u.severity'), { valueNumber: 4 }, 'a2');
    current = answer(current, bankQuestion('u.course'), { valueChoice: 'Getting worse slowly' }, 'a3');

    // Round 0 interpretation, without any checklist.
    current = applyRound(current, pack, interpret([
      draft('Bruise', 'possible', { for: ['visit:complaint'], askableNext: ['Any injury?'] }),
      draft('Cellulitis', 'possible', { for: ['visit:complaint'], askableNext: ['Fever?'] }),
      draft('Flesh-eating infection', 'possible', { tier: 'cant_miss', for: ['visit:complaint'], askableNext: ['Pain out of proportion?'] }),
      draft('Deep vein thrombosis', 'not_enough_information', { tier: 'cant_miss', askableNext: ['Whole leg swollen?'] }),
      draft('Insect bite reaction', 'not_enough_information'),
      draft('Bleeding disorder', 'not_enough_information'),
    ])).case;

    const fever = modelQuestion({ key: 'm1.1', text: 'Do you have any of these right now?', format: 'multi_select', purpose: 'danger', choices: ['Fever', 'Chills', 'Feeling faint'], targets: ['necrotizing_fasciitis', 'sepsis'],
      ifAnswered: ['Fever', 'Chills', 'Feeling faint'].map((choice) => ({ answer: choice, effects: [{ target: 'necrotizing_fasciitis', shift: 'supports' as const }, { target: 'sepsis', shift: 'supports' as const }] })) });
    const speed = modelQuestion({ key: 'm1.2', text: 'How fast is it spreading?', format: 'single_select', purpose: 'danger', choices: ['Within hours', 'Over about a day', 'Over several days'], targets: ['necrotizing_fasciitis'],
      ifAnswered: [
        { answer: 'Within hours', effects: [{ target: 'necrotizing_fasciitis', shift: 'supports' }] },
        { answer: 'Over about a day', effects: [] },
        { answer: 'Over several days', effects: [{ target: 'necrotizing_fasciitis', shift: 'weakens' }] },
      ] });
    const injury = modelQuestion({ key: 'm1.3', targets: ['other:bruise'] });
    const leak = modelQuestion({ key: 'm1.4', text: 'Could this be a flesh-eating infection?', purpose: 'danger', targets: ['necrotizing_fasciitis'] });

    const round1 = choose(current, [injury, fever, speed, bankQuestion('s.pain_proportion'), leak]);
    expect(round1.roundType).toBe('danger');
    expect(round1.chosen.map((question) => question.key)).toEqual(['m1.1', 'm1.2', 's.pain_proportion', 'm1.3']);
    expect(round1.notChosen).toEqual([{ question: leak, reason: 'names_cause' }]);

    current = answer(current, fever, { valueChoices: ['None of these'] }, 'a4');
    current = answer(current, speed, { valueChoice: 'Over several days' }, 'a5');
    current = answer(current, bankQuestion('s.pain_proportion'), { valueBoolean: false }, 'a6');
    const yes = normalizeAnswer(specFor(injury), { valueBoolean: true }, 'en');
    expect(answerSignals(injury, yes, current)).toEqual({ emergency: false, supportsCantMiss: [] });
    current = answer(current, injury, { valueBoolean: true }, 'a7');
    expect(current.evidence.at(-1)?.affirms).toBe(injury.text);

    // Fillers while round 1 plans.
    current = answer(current, bankQuestion('u.medications'), { valueText: 'none' }, 'a8');
    current = answer(current, bankQuestion('u.allergies'), { valueText: 'none' }, 'a9');

    current = applyRound(current, pack, interpret([
      draft('Bruise', 'leading', { for: ['a7'], against: ['visit:complaint'], askableNext: ['Skin broken?'] }),
      draft('Cellulitis', 'possible', { for: ['visit:complaint'], askableNext: ['Spread past the injury?'] }),
      draft('Flesh-eating infection', 'not_supported', { against: ['a4', 'a5', 'a6'], needsInPerson: [{ kind: 'exam', what: 'Feel for a fluid pocket or crackling under the skin', settles: 'necrotizing_fasciitis' }] }),
      draft('DVT', 'not_enough_information', { askableNext: ['Whole leg swollen?'] }),
      draft('Meningitis', 'not_enough_information'),
    ])).case;
    let causes = byId(current);
    // The injury opened the musculoskeletal-injury screen; its answer was already in.
    expect(causes.compartment_syndrome).toMatchObject({ addedBy: 'audit', status: 'not_supported', against: ['a6'], askableNext: [] });
    // The model left sepsis out; code kept it, and the model's fever question counts as its screen.
    expect(causes.sepsis).toMatchObject({ status: 'not_supported', askableNext: [] });
    expect(current.omissions).toContain('sepsis');
    expect(causes.necrotizing_fasciitis).toMatchObject({ tier: 'cant_miss', status: 'not_supported', askableNext: [] });

    const broken = modelQuestion({ key: 'm2.1', text: 'Is the skin broken anywhere on or near the spot?', targets: ['other:cellulitis'],
      ifAnswered: [{ answer: 'Yes', effects: [{ target: 'other:cellulitis', shift: 'supports' }] }, { answer: 'No', effects: [{ target: 'other:cellulitis', shift: 'weakens' }] }] });
    const swollen = modelQuestion({ key: 'm2.2', text: 'Is your whole lower leg swollen, or only around the spot?', format: 'single_select', choices: ['Whole lower leg', 'Only around the spot'], targets: ['dvt'],
      ifAnswered: [{ answer: 'Whole lower leg', effects: [{ target: 'dvt', shift: 'supports' }] }, { answer: 'Only around the spot', effects: [{ target: 'dvt', shift: 'weakens' }] }] });
    const spread = modelQuestion({ key: 'm2.3', text: 'Has the redness spread past where you were hit?', targets: ['other:cellulitis'],
      ifAnswered: [{ answer: 'Yes', effects: [{ target: 'other:cellulitis', shift: 'supports' }] }, { answer: 'No', effects: [{ target: 'other:cellulitis', shift: 'weakens' }] }] });
    const conditions = bankQuestion('u.conditions');

    const round2 = choose(current, [broken, swollen, spread, conditions]);
    expect(round2.roundType).toBe('distinguish');
    expect(round2.chosen.map((question) => question.key)).toEqual(['m2.2', 'm2.1', 'm2.3', 'u.conditions']);

    current = answer(current, swollen, { valueChoice: 'Only around the spot' }, 'a10');
    current = answer(current, broken, { valueBoolean: false }, 'a11');
    current = answer(current, spread, { notSure: true }, 'a12');
    current = answer(current, conditions, { valueText: 'none' }, 'a13');

    current = applyRound(current, pack, interpret([
      draft('Bruise', 'leading', { for: ['a7'], against: ['visit:complaint'] }),
      draft('Cellulitis', 'less_likely', { for: ['visit:complaint'], against: ['a11'], needsInPerson: [{ kind: 'exam', what: 'Mark the edge of the redness and recheck it', settles: 'other:cellulitis' }] }),
      draft('Flesh-eating infection', 'not_supported', { against: ['a4', 'a5', 'a6'] }),
      draft('DVT', 'not_supported', { against: ['a10'], needsInPerson: [{ kind: 'exam', what: 'Examine the calf', settles: 'dvt' }] }),
      draft('Meningitis', 'not_enough_information'),
    ])).case;
    causes = byId(current);
    expect(causes['other:bruise'].status).toBe('leading');
    expect(causes['other:cellulitis'].status).toBe('less_likely');
    expect(causes.dvt).toMatchObject({ status: 'not_supported', tier: 'cant_miss' });

    // Everything left needs hands-on examination: the askable limit.
    expect(current.asked).toHaveLength(13);
    expect(stopRule(current, stopCtx(current))).toBe('case_done');
    expect(current.candidates.filter((candidate) => candidate.tier === 'cant_miss').map((candidate) => candidate.id).sort())
      .toEqual(['compartment_syndrome', 'dvt', 'meningitis', 'necrotizing_fasciitis', 'sepsis']);
  });
});
