import { describe, expect, it } from 'vitest';

import { normalizeAnswer } from '../src/modules/assessment/case/answers';
import { causeApplies, causeTerms, complaintSystems, dangerousCauseAudit, normalizeLabel, resolveCauseId } from '../src/modules/assessment/case/audit';
import { applyRound, initialCase, subjectOf } from '../src/modules/assessment/case/case-builder';
import { answerSignals, descriptionEvidence, matchedOutcomes, recordAnswer, structuredEvidence } from '../src/modules/assessment/case/evidence';
import { citeKnown, enforceSupportLevel, raiseOnly, retainCantMiss, toCandidates } from '../src/modules/assessment/case/guards';
import type { Candidate, CandidateDraft, InterpreterOutput } from '../src/modules/assessment/case/types';
import { answer, bankQuestion, communication, modelQuestion, pack, seed, specFor, startCase } from './assessment-fixtures';

const ctx = { answerId: 'a1', language: 'en' as const, answeredBy: 'self' as const };

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return { id: 'other:bruise', label: 'Bruise', tier: 'routine', status: 'possible', for: ['a1'], against: [], askableNext: [], needsInPerson: [], addedBy: 'model', ...overrides };
}

function draft(overrides: Partial<CandidateDraft> = {}): CandidateDraft {
  return { label: 'Bruise', tier: 'routine', status: 'leading', for: ['a1'], against: [], askableNext: [], needsInPerson: [], ...overrides };
}

function interpreter(overrides: Partial<InterpreterOutput> = {}): InterpreterOutput {
  return {
    complaints: [], history: [], candidates: [], whatElse: '', contradictions: [],
    escalate: { level: 'none', reason: '', answerIds: [] }, emergency: { flagged: false, reason: '', answerIds: [] }, integrity: 'ok',
    ...overrides,
  };
}

describe('evidence', () => {
  it('turns yes/no into reported or denied evidence through the question’s targets', () => {
    const question = bankQuestion('s.leg_swelling');
    const yes = structuredEvidence(question, normalizeAnswer(specFor(question), { valueBoolean: true }, 'en'), ctx);
    const no = structuredEvidence(question, normalizeAnswer(specFor(question), { valueBoolean: false }, 'en'), ctx);
    expect(yes).toEqual([expect.objectContaining({ id: 'a1#0', kind: 'reported', targets: ['dvt', 'pulmonary_embolism'], patientWords: 'Yes', source: 'structured' })]);
    expect(no[0].kind).toBe('denied');
  });

  it('records "Not sure" as uncertainty, never as a denial', () => {
    const question = bankQuestion('s.leg_swelling');
    const items = structuredEvidence(question, normalizeAnswer(specFor(question), { notSure: true }, 'en'), ctx);
    expect(items).toEqual([expect.objectContaining({ kind: 'not_sure', targets: ['dvt', 'pulmonary_embolism'] })]);
    expect(matchedOutcomes(question, normalizeAnswer(specFor(question), { notSure: true }, 'en'))).toEqual([]);
  });

  it('treats a checklist as ticked = reported and unticked = denied', () => {
    const question = bankQuestion('u.recent_events');
    const ticked = structuredEvidence(question, normalizeAnswer(specFor(question), { valueChoices: ['An injury or fall'] }, 'en'), ctx);
    expect(ticked.map((item) => item.kind)).toEqual(['reported', 'denied', 'denied', 'denied']);
    expect(ticked[0].targets).toEqual(['recent_events', 'compartment_syndrome']);
    const none = structuredEvidence(question, normalizeAnswer(specFor(question), { valueChoices: ['None of these'] }, 'en'), ctx);
    expect(none.every((item) => item.kind === 'denied')).toBe(true);
  });

  it('marks vague free text and matches scale ranges', () => {
    const text = bankQuestion('u.character');
    expect(structuredEvidence(text, normalizeAnswer(specFor(text), { valueText: 'idk' }, 'en'), ctx)[0].kind).toBe('vague');
    expect(structuredEvidence(text, normalizeAnswer(specFor(text), { valueText: 'Throbbing and burning' }, 'en'), ctx)[0].kind).toBe('reported');
    const scale = { ...bankQuestion('u.severity'), ifAnswered: [{ answer: '9-10', effects: [{ target: 'severity', shift: 'fills' as const }], emergency: true }, { answer: '3', effects: [] }] };
    expect(matchedOutcomes(scale, normalizeAnswer(specFor(scale), { valueNumber: 9 }, 'en'))).toHaveLength(1);
    expect(matchedOutcomes(scale, normalizeAnswer(specFor(scale), { valueNumber: 3 }, 'en'))).toEqual([{ answer: '3', effects: [] }]);
    expect(matchedOutcomes(scale, normalizeAnswer(specFor(scale), { valueNumber: 5 }, 'en'))).toEqual([]);
    expect(matchedOutcomes(bankQuestion('u.onset'), normalizeAnswer(specFor(bankQuestion('u.onset')), { valueDuration: { amount: 2, unit: 'days' } }, 'en'))).toEqual([]);
  });

  it('cites the opening words as visit:complaint and visit:note', () => {
    expect(descriptionEvidence('Sore throat', 'Since Sunday', { language: 'fr', answeredBy: 'parent' }).map((item) => item.answerId)).toEqual(['visit:complaint', 'visit:note']);
    expect(descriptionEvidence('  ', null, { language: 'en', answeredBy: 'self' })).toEqual([]);
  });

  it('flags emergency answers and answers that support a dangerous cause', () => {
    const current = startCase();
    const stroke = bankQuestion('s.stroke');
    expect(answerSignals(stroke, normalizeAnswer(specFor(stroke), { valueBoolean: true }, 'en'), current)).toEqual({ emergency: true, supportsCantMiss: [] });
    const legs = bankQuestion('s.leg_swelling');
    expect(answerSignals(legs, normalizeAnswer(specFor(legs), { valueBoolean: true }, 'en'), current)).toEqual({ emergency: false, supportsCantMiss: ['dvt'] });
    expect(answerSignals(legs, normalizeAnswer(specFor(legs), { valueBoolean: false }, 'en'), current).supportsCantMiss).toEqual([]);
  });

  it('fills history, keeps a real answer over an earlier "not sure", and records the question as asked', () => {
    let current = startCase();
    const meds = bankQuestion('u.medications');
    current = answer(current, meds, { notSure: true }, 'a1');
    expect(current.history.medications?.status).toBe('unknown');
    current = recordAnswer(current, meds, normalizeAnswer(specFor(meds), { valueText: 'none' }, 'en'), { ...ctx, answerId: 'a2' });
    expect(current.history.medications).toEqual({ status: 'filled', evidenceIds: ['a1#0', 'a2#0'] });
    current = recordAnswer(current, meds, normalizeAnswer(specFor(meds), { notSure: true }, 'en'), { ...ctx, answerId: 'a3' });
    expect(current.history.medications?.status).toBe('filled');
    expect(current.asked.map((asked) => asked.key)).toEqual(['u.medications', 'u.medications', 'u.medications']);
  });
});

describe('guards', () => {
  it('lets urgency rise and never fall', () => {
    expect(raiseOnly('none', 'caution')).toBe('caution');
    expect(raiseOnly('escalate', 'none')).toBe('escalate');
    expect(raiseOnly('caution', 'caution')).toBe('caution');
  });

  it('keeps only citations that exist', () => {
    expect(citeKnown(['a1', 'a9', 'a1'], new Set(['a1']))).toEqual(['a1']);
  });

  it('backs every support level with its evidence', () => {
    expect(enforceSupportLevel('leading', [], [])).toBe('not_enough_information');
    expect(enforceSupportLevel('possible', [], ['a2'])).toBe('less_likely');
    expect(enforceSupportLevel('not_supported', [], [])).toBe('not_enough_information');
    expect(enforceSupportLevel('less_likely', ['a1'], [])).toBe('possible');
    expect(enforceSupportLevel('leading', ['a1'], [])).toBe('leading');
    expect(enforceSupportLevel('not_supported', [], ['a2'])).toBe('not_supported');
    expect(enforceSupportLevel('not_enough_information', ['a1'], ['a2'])).toBe('not_enough_information');
  });

  it('merges duplicate causes and counts dropped citations', () => {
    const { candidates, droppedCitations } = toCandidates(
      [draft({ for: ['a1', 'a9'] }), draft({ for: [], against: ['a2'], tier: 'cant_miss', askableNext: ['Ask about injury'] }), draft({ label: 'Cellulitis', status: 'possible', for: ['a9'] })],
      (entry) => `other:${entry.label.toLowerCase()}`, new Set(['a1', 'a2']),
    );
    expect(droppedCitations).toBe(2);
    expect(candidates).toEqual([
      expect.objectContaining({ id: 'other:bruise', for: ['a1'], against: ['a2'], tier: 'cant_miss', status: 'leading', askableNext: ['Ask about injury'] }),
      expect.objectContaining({ id: 'other:cellulitis', status: 'not_enough_information', for: [] }),
    ]);
  });

  it('never lets the model drop a dangerous or audit-added cause, or demote a dangerous one', () => {
    const previous = [
      candidate({ id: 'dvt', tier: 'cant_miss', addedBy: 'audit' }),
      candidate({ id: 'appendicitis', tier: 'urgent', addedBy: 'audit' }),
      candidate({ id: 'other:cellulitis' }),
      candidate({ id: 'necrotizing_fasciitis', tier: 'cant_miss' }),
    ];
    const { candidates, omissions } = retainCantMiss(previous, [candidate({ id: 'necrotizing_fasciitis', tier: 'routine' })]);
    expect(candidates.map((entry) => [entry.id, entry.tier])).toEqual([['necrotizing_fasciitis', 'cant_miss'], ['dvt', 'cant_miss'], ['appendicitis', 'urgent']]);
    expect(omissions).toEqual(['dvt']);
  });
});

describe('dangerous-cause audit', () => {
  it('reads body systems from English and French words without false matches', () => {
    expect(complaintSystems(['Growing purple spot on my leg'])).toEqual(expect.arrayContaining(['general', 'skin', 'musculoskeletal']));
    expect(complaintSystems(['Mal de gorge et toux depuis dimanche'])).toEqual(expect.arrayContaining(['ent', 'respiratory']));
    expect(complaintSystems(['A car accident, evidently fine'])).toEqual(['general']);
    expect(complaintSystems([null, undefined])).toEqual(['general']);
  });

  it('maps model names to pack causes by label or synonym', () => {
    expect(resolveCauseId(pack, 'Flesh-eating infection')).toBe('necrotizing_fasciitis');
    expect(resolveCauseId(pack, 'Possible DVT (deep vein thrombosis)')).toBe('dvt');
    expect(resolveCauseId(pack, 'MI')).toBe('heart_attack');
    expect(resolveCauseId(pack, 'Migraine')).toBe('other:migraine');
    expect(resolveCauseId(pack, 'anything', 'sepsis')).toBe('sepsis');
    expect(resolveCauseId(pack, 'Contact dermatitis', 'other:dermatitis')).toBe('other:dermatitis');
    expect(resolveCauseId(pack, '()')).toBe('other:unnamed');
    expect(normalizeLabel('Heart Attack (ACS), maybe')).toBe('heart attack acs maybe');
  });

  it('lists every name a question must not say', () => {
    const terms = causeTerms(pack, [candidate({ label: 'Simple bruise' })]);
    expect(terms).toEqual(expect.arrayContaining(['flesh-eating', 'dvt', 'simple bruise']));
  });

  it('adds dangerous causes for the systems, words, age and sex; unknown age or sex includes them', () => {
    const cause = (id: string) => pack.causes.find((entry) => entry.id === id)!;
    const base = { systems: ['general', 'abdominal', 'reproductive'] as const, text: 'belly pain', age: 30, sex: 'female' as const };
    expect(causeApplies(cause('ectopic_pregnancy'), { ...base, systems: [...base.systems] })).toBe(true);
    expect(causeApplies(cause('ectopic_pregnancy'), { ...base, systems: [...base.systems], sex: 'male' })).toBe(false);
    expect(causeApplies(cause('ectopic_pregnancy'), { ...base, systems: [...base.systems], age: 60 })).toBe(false);
    expect(causeApplies(cause('ectopic_pregnancy'), { ...base, systems: [...base.systems], age: 8 })).toBe(false);
    expect(causeApplies(cause('ectopic_pregnancy'), { ...base, systems: [...base.systems], age: null, sex: null })).toBe(true);
    expect(causeApplies(cause('cauda_equina'), { systems: ['musculoskeletal'], text: 'sprained knee', age: 40, sex: null })).toBe(false);
    expect(causeApplies(cause('cauda_equina'), { systems: ['musculoskeletal'], text: 'lower back pain', age: 40, sex: null })).toBe(true);
    expect(causeApplies(cause('sepsis'), { systems: ['general'], text: '', age: null, sex: null })).toBe(true);
    const added = dangerousCauseAudit(pack, { systems: ['general', 'skin', 'musculoskeletal'], text: 'purple spot on my leg, spreading', age: 34, sex: 'male' }, [candidate({ id: 'dvt' })]);
    expect(added.map((entry) => entry.id)).toEqual(['sepsis', 'meningitis', 'necrotizing_fasciitis']);
    expect(added[0]).toMatchObject({ status: 'not_enough_information', addedBy: 'audit', askableNext: ['s.fever_unwell', 's.rash_fade'] });
  });
});

describe('case builder', () => {
  it('starts from the patient’s words, code’s systems and the audit, asking one screen per cause', () => {
    const current = startCase();
    expect(current.version).toBe(1);
    expect(current.complaints).toEqual([expect.objectContaining({ id: 'complaint', characterized: false })]);
    expect(current.candidates.map((entry) => [entry.id, entry.askableNext])).toEqual([
      ['sepsis', ['s.fever_unwell']], ['dvt', ['s.leg_swelling']], ['meningitis', ['s.neck_light']], ['necrotizing_fasciitis', ['s.pain_proportion']],
    ]);
    expect(current.auditAdded).toEqual(['sepsis', 'dvt', 'meningitis', 'necrotizing_fasciitis']);
    expect(subjectOf(current)).toEqual({ age: 34, sex: 'male', audience: 'self' });
  });

  it('scores audit-added causes from their screens when no model assessed them', () => {
    let current = startCase();
    current = answer(current, bankQuestion('s.leg_swelling'), { valueBoolean: false }, 'a1');
    current = answer(current, bankQuestion('s.pain_proportion'), { notSure: true }, 'a2');
    current = answer(current, bankQuestion('s.fever_unwell'), { valueBoolean: true }, 'a3');
    const next = applyRound(current, pack, null).case;
    const byId = Object.fromEntries(next.candidates.map((entry) => [entry.id, entry]));
    expect(byId.dvt).toMatchObject({ status: 'not_supported', against: ['a1'], askableNext: [] });
    expect(byId.necrotizing_fasciitis).toMatchObject({ status: 'not_enough_information', askableNext: ['s.spreading_fast'] });
    expect(byId.sepsis).toMatchObject({ status: 'possible', for: ['a3'], askableNext: ['s.rash_fade'] });
    expect(next.version).toBe(2);
  });

  it('adds causes when later answers open a system, and characterises the complaint once onset, severity and course are known', () => {
    let current = startCase();
    current = answer(current, bankQuestion('u.recent_events'), { valueChoices: ['An injury or fall'] }, 'a1');
    current = answer(current, bankQuestion('u.onset'), { valueDuration: { amount: 2, unit: 'days' } }, 'a2');
    current = answer(current, bankQuestion('u.severity'), { valueNumber: 4 }, 'a3');
    current = answer(current, bankQuestion('u.course'), { valueChoice: 'Staying about the same' }, 'a4');
    const next = applyRound(current, pack, null).case;
    expect(next.candidates.map((entry) => entry.id)).toContain('compartment_syndrome');
    expect(next.complaints[0].characterized).toBe(true);
  });

  it('turns a dangerous cause screened only in person into an ask-in-the-room item', () => {
    const current = initialCase(seed({ complaint: 'Feeling very low and anxious, can’t sleep' }), pack);
    expect(current.candidates.find((entry) => entry.id === 'self_harm_risk')).toMatchObject({ askableNext: [] });
    expect(current.askInRoom).toEqual([{ text: 'Ask privately about any thoughts of self-harm or suicide.', reason: 'Sensitive; better asked in person.', answerIds: [] }]);
    expect(applyRound(current, pack, null).case.askInRoom).toHaveLength(1);
  });

  it('applies the interpreter’s view under code’s guards', () => {
    let current = startCase();
    current = answer(current, modelQuestion(), { valueBoolean: true }, 'a1');
    const result = applyRound(current, pack, interpreter({
      complaints: [{ id: 'leg', patientWords: 'purple spot on my leg', systems: ['skin'], characterized: true }],
      history: [
        { element: 'onset', status: 'filled', answerIds: ['visit:complaint'] },
        { element: 'severity', status: 'filled', answerIds: ['a99'] },
        { element: 'course', status: 'unknown', answerIds: [] },
      ],
      candidates: [
        draft({ label: 'Bruise', status: 'leading', for: ['a1', 'a99'], askableNext: ['Is the skin broken?'] }),
        draft({ label: 'Flesh-eating infection', tier: 'routine', status: 'not_supported', for: [], against: ['a1'], askableNext: [] }),
      ],
      contradictions: [{ answerIds: ['a1', 'visit:complaint'], note: 'Said spreading fast, then hit two days ago' }, { answerIds: ['a1'], note: 'too few' }],
      escalate: { level: 'caution', reason: 'Spreading redness', answerIds: ['visit:complaint'] },
    }));
    const next = result.case;
    expect(result.droppedCitations).toBe(1);
    expect(next.complaints).toEqual([expect.objectContaining({ id: 'leg', characterized: true })]);
    expect(next.history.onset?.status).toBe('filled');
    expect(next.history.severity).toBeUndefined();
    expect(next.history.course?.status).toBe('unknown');
    const byId = Object.fromEntries(next.candidates.map((entry) => [entry.id, entry]));
    expect(byId['other:bruise']).toMatchObject({ status: 'leading', for: ['a1'], addedBy: 'model' });
    // The pack calls it dangerous, so it stays dangerous; the model assessed it, so its view stands.
    expect(byId.necrotizing_fasciitis).toMatchObject({ tier: 'cant_miss', status: 'not_supported', askableNext: [] });
    // Dropped by the model: kept, reported as an omission.
    expect(byId.dvt).toMatchObject({ addedBy: 'audit', askableNext: ['s.leg_swelling'] });
    expect(result.omissions).toEqual(['sepsis', 'dvt', 'meningitis']);
    expect(next.contradictions).toEqual([{ answerIds: ['a1', 'visit:complaint'], note: 'Said spreading fast, then hit two days ago', clarified: false }]);
    expect(next.urgency).toEqual({ model: 'caution', reasons: ['Spreading redness'], answerIds: ['visit:complaint'] });
  });

  it('ignores an uncited escalation, never lowers urgency, and never lets "unknown" overwrite "filled"', () => {
    let current = startCase();
    current = answer(current, bankQuestion('u.severity'), { valueNumber: 6 }, 'a1');
    const raised = applyRound(current, pack, interpreter({ escalate: { level: 'escalate', reason: 'Severe', answerIds: ['a1'] } })).case;
    const after = applyRound(raised, pack, interpreter({
      escalate: { level: 'none', reason: '', answerIds: ['a1'] },
      history: [{ element: 'severity', status: 'unknown', answerIds: [] }],
      contradictions: [{ answerIds: ['visit:complaint', 'a1'], note: 'x' }, { answerIds: ['a1', 'visit:complaint'], note: 'same pair' }],
    })).case;
    expect(after.urgency.model).toBe('escalate');
    expect(after.history.severity?.status).toBe('filled');
    expect(after.contradictions).toHaveLength(1);
    const uncited = applyRound(startCase(), pack, interpreter({ escalate: { level: 'escalate', reason: 'Gut feeling', answerIds: [] } })).case;
    expect(uncited.urgency.model).toBe('none');
  });

  it('records who answered and in which language', () => {
    const current = initialCase(seed({ communication: communication({ language: 'fr', answeredBy: 'parent', subjectAge: 6 }), patient: { age: 6, sex: 'female' } }), pack);
    expect(current.evidence[0]).toMatchObject({ language: 'fr', answeredBy: 'parent' });
    expect(subjectOf(current).audience).toBe('child');
  });
});
