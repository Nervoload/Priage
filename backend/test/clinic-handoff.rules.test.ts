import { describe, expect, it } from 'vitest';

import { buildClinicHandoff, CLINIC_HANDOFF_RULES_VERSION, type HandoffAnswer, type HandoffInput } from '../src/modules/clinic/care/clinic-handoff.rules';
import { findMention, isVagueAnswer } from '../src/modules/clinic/care/patient-text';
import { RESCUE_QUESTION_BANK, rescueBankKeyFor } from '../src/modules/intake/interview/rescue-question-bank';
import { SAFETY_GATE_PUBLIC_ID } from '../src/modules/intake/interview/triage-interview.types';

const bank = {
  timeline: RESCUE_QUESTION_BANK.urgent[0],
  severity: RESCUE_QUESTION_BANK.urgent[1],
  screen: RESCUE_QUESTION_BANK.urgent[2],
  associated: RESCUE_QUESTION_BANK.emergent[0],
  selfCare: RESCUE_QUESTION_BANK.emergent[1],
  activity: RESCUE_QUESTION_BANK.emergent[2],
  conditions: RESCUE_QUESTION_BANK.history[0],
  medsAllergies: RESCUE_QUESTION_BANK.history[1],
};

function answer(id: string, question: { prompt: string; inputType: string; phase: string }, answerText: string, extra: Partial<HandoffAnswer> = {}): HandoffAnswer {
  return {
    questionId: id, prompt: question.prompt, answerText, inputType: question.inputType, phase: question.phase, answeredAt: '2026-10-03T14:00:00.000Z',
    source: 'ai', bankKey: rescueBankKeyFor(question.prompt),
    ...(question.inputType === 'boolean' ? { valueBoolean: answerText === 'Yes' } : {}),
    ...(question.inputType === 'number' ? { valueNumber: Number(answerText) } : {}),
    ...extra,
  };
}

const safety = (yes: boolean) => answer(SAFETY_GATE_PUBLIC_ID, { prompt: 'Are you in immediate danger right now?', inputType: 'boolean', phase: 'urgent' }, yes ? 'Yes' : 'No', { source: 'safety', bankKey: null });

function input(overrides: Partial<HandoffInput> = {}): HandoffInput {
  return {
    complaint: 'Sore throat and fever since Sunday',
    patientNote: null,
    age: 34,
    gender: 'F',
    allergies: null,
    conditions: null,
    answers: [
      safety(false),
      answer('q1', bank.timeline, 'Sunday morning'),
      answer('q2', bank.severity, '5'),
      answer('q3', bank.screen, 'No'),
      answer('q4', bank.associated, 'Fever and painful swallowing, no cough'),
      answer('q5', bank.medsAllergies, 'Salbutamol inhaler, allergic to penicillin'),
    ],
    unasked: [],
    interview: { askedCount: 5, maxQuestions: 12 },
    emergencyEvents: [],
    partial: false,
    modelCaseSummary: null,
    ...overrides,
  };
}

function withAnswers(...answers: HandoffAnswer[]): HandoffInput {
  return input({ answers });
}

describe('patient text', () => {
  it('reads curly apostrophes the way phones type them', () => {
    expect(findMention('I haven’t fainted', /faint(ed)?/).status).toBe('denied');
    expect(isVagueAnswer('I don’t know', 'text')).toBe(true);
  });

  it('treats a negation earlier in the clause as a denial', () => {
    expect(findMention('No chest pain at all', /chest pain/).status).toBe('denied');
    expect(findMention('I have chest pain and no fever', /chest pain/).status).toBe('reported');
    expect(findMention('no fever yesterday, but chest pain today', /chest pain/).status).toBe('reported');
    expect(findMention('', /chest pain/).status).toBe('none');
  });

  it('ignores phrases that only look like symptoms', () => {
    expect(findMention('My blood pressure is high', /bleeding|blood/).status).toBe('none');
  });

  it('flags vague free-text answers only', () => {
    expect(isVagueAnswer('not sure', 'text')).toBe(true);
    expect(isVagueAnswer('ok', 'textarea')).toBe(true);
    expect(isVagueAnswer('No', 'boolean')).toBe(false);
    expect(isVagueAnswer('Since Sunday morning', 'text')).toBe(false);
    expect(isVagueAnswer('Ice and ibuprofen. It helps a bit.', 'text')).toBe(false);
    expect(isVagueAnswer('maybe yesterday', 'text')).toBe(true);
  });
});

describe('clinic urgency', () => {
  it('is Clear and lists what was denied when nothing is high-risk', () => {
    const handoff = buildClinicHandoff(input());
    expect(handoff.urgency.level).toBe('clear');
    expect(handoff.urgency.sentence).toBe('Clear: no high-risk answers');
    expect(handoff.urgency.reasons.map((reason) => reason.text)).toEqual([
      'Said they were not in immediate danger',
      'Denied trouble breathing, heavy bleeding and fainting or passing out',
      'Severity 5/10',
    ]);
    expect(handoff.urgency.reasons[1].refs).toEqual(['answer:q3']);
    expect(handoff.redFlags).toEqual([]);
  });

  it('escalates when the patient says they are in immediate danger', () => {
    const handoff = buildClinicHandoff(withAnswers(safety(true)));
    expect(handoff.urgency.level).toBe('escalate');
    expect(handoff.urgency.reasons[0]).toMatchObject({ ruleId: 'escalate.safety_gate', refs: [`answer:${SAFETY_GATE_PUBLIC_ID}`] });
    expect(handoff.redFlags[0].label).toBe('Said they were in immediate danger');
  });

  it('escalates on a Yes to the red-flag screen and marks each named domain reported', () => {
    const handoff = buildClinicHandoff(withAnswers(safety(false), answer('q3', bank.screen, 'Yes')));
    expect(handoff.urgency.level).toBe('escalate');
    const reported = handoff.redFlagScreen.filter((row) => row.status === 'reported').map((row) => row.domain);
    expect(reported).toEqual(['breathing', 'heavy_bleeding', 'fainting', 'rapid_worsening']);
    expect(handoff.redFlags.map((flag) => flag.label)).toEqual(['Trouble breathing', 'Heavy bleeding', 'Fainting or passing out']);
  });

  it.each([
    ['9', 'escalate'],
    ['7', 'caution'],
    ['4', 'clear'],
  ])('maps severity %s/10 to %s', (score, level) => {
    expect(buildClinicHandoff(withAnswers(safety(false), answer('q2', bank.severity, score))).urgency.level).toBe(level);
  });

  it('raises Caution for worse with activity, sudden onset and dehydration signs', () => {
    const handoff = buildClinicHandoff(input({
      complaint: 'Dizzy and vomiting',
      answers: [safety(false), answer('q1', bank.timeline, 'It came on suddenly this morning'), answer('q6', bank.activity, 'Yes'), answer('q4', bank.associated, "I can't keep anything down")],
    }));
    expect(handoff.urgency.level).toBe('caution');
    expect(handoff.urgency.reasons.map((reason) => reason.ruleId)).toEqual(['caution.worse_activity', 'caution.sudden_onset', 'caution.dehydration', 'caution.dizziness']);
  });

  it('does not read a question as a symptom, or "blood pressure" as bleeding', () => {
    const handoff = buildClinicHandoff(input({ complaint: 'Follow-up on blood pressure readings', answers: [safety(false), answer('q3', bank.screen, 'No')] }));
    expect(handoff.urgency.level).toBe('clear');
    expect(handoff.redFlagScreen.find((row) => row.domain === 'heavy_bleeding')?.status).toBe('denied');
  });

  it('reads ongoing bleeding in the patient’s own note as heavy bleeding', () => {
    const handoff = buildClinicHandoff(input({ complaint: 'Cut on my hand from a kitchen knife', patientNote: 'It keeps bleeding through the towel.' }));
    expect(handoff.urgency.level).toBe('escalate');
    expect(handoff.redFlagScreen.find((row) => row.domain === 'heavy_bleeding')).toMatchObject({ status: 'reported', refs: expect.arrayContaining(['visit:note']) });
    expect(buildClinicHandoff(input({ complaint: 'Cut finger', patientNote: 'Blood soaking through the bandage', answers: [safety(false)] })).urgency.level).toBe('escalate');
    expect(buildClinicHandoff(input({ complaint: 'Cut finger', patientNote: 'It isn’t bleeding through anymore', answers: [safety(false)] })).urgency.level).not.toBe('escalate');
  });

  it('honours a negated mention in the patient note', () => {
    const handoff = buildClinicHandoff(input({ complaint: 'Chest feels tight after a cold', patientNote: 'No chest pain, just a cough.', answers: [safety(false)] }));
    expect(handoff.redFlagScreen.find((row) => row.domain === 'chest')).toMatchObject({ status: 'denied', refs: ['visit:note'] });
  });

  it('says when it is based on an unfinished assessment', () => {
    expect(buildClinicHandoff(input({ partial: true })).urgency.sentence).toBe('Clear: no high-risk answers, based on an unfinished assessment');
  });

  it('escalates when the patient saw a model emergency warning', () => {
    const handoff = buildClinicHandoff(input({ emergencyEvents: [{ id: 'emergency-0', trigger: 'model_interrupt', triggerQuestionId: 'q4', title: 'Get help', body: '', reason: 'Possible airway compromise', shownAt: '2026-10-03T14:00:00.000Z', acknowledgedAt: '2026-10-03T14:01:00.000Z' }] }));
    expect(handoff.urgency.level).toBe('escalate');
    expect(handoff.urgency.reasons[0].refs).toEqual(['emergency:0']);
    expect(handoff.gaps.map((gap) => gap.kind)).toContain('emergency_continued');
    expect(handoff.nextSteps.map((step) => step.ruleId)).toContain('next.emergency_followup');
  });
});

describe('ask in the room and gaps', () => {
  it('asks again about vague answers, must-ask in the red-flag stage', () => {
    const handoff = buildClinicHandoff(withAnswers(safety(false), answer('q1', bank.timeline, 'not sure'), answer('q3', bank.screen, 'No')));
    expect(handoff.askInRoom[0]).toMatchObject({ category: 'clarify', priority: 'must', basedOn: ['answer:q1'] });
    expect(handoff.gaps.map((gap) => gap.kind)).toContain('vague_answer');
  });

  it('asks about red flags linked to the complaint that were never screened', () => {
    const handoff = buildClinicHandoff(input({ complaint: 'Heart racing at night', answers: [safety(false), answer('q3', bank.screen, 'No')] }));
    const chest = handoff.askInRoom.find((item) => item.ruleId === 'ask.screen.chest');
    expect(chest).toMatchObject({ priority: 'must', category: 'history' });
    expect(handoff.gaps.map((gap) => gap.text)).toContain('Not screened: chest pain or pressure');
    const described = buildClinicHandoff(input({ complaint: 'Pain in my chest when I climb stairs', answers: [safety(false)] }));
    expect(described.urgency.level).toBe('escalate');
    expect(described.redFlags.map((flag) => flag.refs)).toEqual([['visit:complaint']]);
  });

  it('asks for medications and allergies only when they were not established', () => {
    expect(buildClinicHandoff(input()).askInRoom.some((item) => item.ruleId === 'ask.history.meds_allergies')).toBe(false);
    const missing = buildClinicHandoff(input({ age: 70, answers: [safety(false), answer('q3', bank.screen, 'No')] }));
    expect(missing.askInRoom.find((item) => item.ruleId === 'ask.history.meds_allergies')).toMatchObject({ priority: 'must', text: 'Which medications do they take, and do they have any allergies?' });
    expect(missing.gaps.map((gap) => gap.kind)).toContain('missing_history');
    const allergiesOnProfile = buildClinicHandoff(input({ allergies: 'Penicillin', answers: [safety(false), answer('q3', bank.screen, 'No')] }));
    expect(allergiesOnProfile.askInRoom.find((item) => item.ruleId === 'ask.history.meds_allergies')?.text).toBe('Which medications do they take?');
  });

  it('suggests private questions that are better asked in person', () => {
    const handoff = buildClinicHandoff(input({ complaint: 'Lower abdominal pain and burning when I pee' }));
    expect(handoff.askInRoom.filter((item) => item.category === 'sensitive').map((item) => item.ruleId)).toEqual(['ask.sensitive.pregnancy', 'ask.sensitive.sexual_health']);
    expect(buildClinicHandoff(input({ complaint: 'Lower abdominal pain', gender: 'M' })).askInRoom.some((item) => item.ruleId === 'ask.sensitive.pregnancy')).toBe(false);
  });

  it('keeps at most six items, must-ask first', () => {
    const handoff = buildClinicHandoff(input({
      complaint: 'Headache, chest tightness, rash and low mood, burning when I pee',
      age: 30,
      answers: [safety(false), answer('q1', bank.timeline, 'not sure'), answer('q2', bank.severity, '8'), answer('q6', bank.activity, 'Yes')],
    }));
    expect(handoff.askInRoom.length).toBe(6);
    const priorities = handoff.askInRoom.map((item) => item.priority);
    expect(priorities).toEqual([...priorities].sort((left, right) => (left === right ? 0 : left === 'must' ? -1 : 1)));
  });

  it('records question-limit, not-asked and unfinished gaps', () => {
    const handoff = buildClinicHandoff(input({ interview: { askedCount: 12, maxQuestions: 12 }, unasked: [{ questionId: 'u1', question: 'Any recent travel?' }], partial: true }));
    expect(handoff.gaps.map((gap) => gap.kind)).toEqual(expect.arrayContaining(['question_limit', 'not_asked', 'interview_unfinished']));
    expect(handoff.gaps.find((gap) => gap.kind === 'not_asked')).toMatchObject({ text: '1 generated question wasn’t asked', refs: ['unasked:u1'] });
  });
});

describe('clinic questions', () => {
  const travel = (yes: boolean) => answer('clinic:travel_14d', { prompt: 'Have you travelled outside Canada in the last 14 days?', inputType: 'boolean', phase: 'urgent' }, yes ? 'Yes' : 'No', { source: 'clinic', bankKey: null });

  it('asks about the trip when they travelled', () => {
    const handoff = buildClinicHandoff(input({ answers: [safety(false), travel(true), ...input().answers.slice(1)] }));
    expect(handoff.askInRoom.find((item) => item.ruleId === 'ask.clinic.travel')).toMatchObject({ priority: 'worth', basedOn: ['answer:clinic:travel_14d'] });
    expect(buildClinicHandoff(input({ answers: [safety(false), travel(false)] })).askInRoom.some((item) => item.ruleId === 'ask.clinic.travel')).toBe(false);
  });

  it('records a gap when the clinic’s questions weren’t all answered', () => {
    expect(buildClinicHandoff(input({ clinicQuestions: { expected: true, answered: false } })).gaps.map((gap) => gap.kind)).toContain('clinic_questions_missing');
    expect(buildClinicHandoff(input({ clinicQuestions: { expected: true, answered: true } })).gaps.map((gap) => gap.kind)).not.toContain('clinic_questions_missing');
  });
});

describe('briefing and determinism', () => {
  it('writes a plain briefing with no CTAS or ED wording', () => {
    const handoff = buildClinicHandoff(input());
    expect(handoff.briefing).toBe('34-year-old female with “Sore throat and fever since Sunday”, started Sunday morning, severity 5/10.');
    expect(JSON.stringify(handoff)).not.toMatch(/ctas|emergency department/i);
    expect(handoff.rulesVersion).toBe(CLINIC_HANDOFF_RULES_VERSION);
    expect(buildClinicHandoff(input({ gender: 'nonbinary', age: null, answers: [] })).briefing).toBe('Non-binary with “Sore throat and fever since Sunday”.');
    expect(buildClinicHandoff(input({ gender: 'Two-spirit', age: 40, answers: [] })).briefing).toMatch(/^40-year-old two-spirit with/);
    expect(buildClinicHandoff(input({ gender: null, age: null, answers: [] })).briefing).toMatch(/^Patient with/);
  });

  it('keeps only the first sentence of the timeline, written to follow “started”', () => {
    const briefingFor = (timeline: string) => buildClinicHandoff(input({ answers: [safety(false), answer('q1', bank.timeline, timeline)] })).briefing;
    expect(briefingFor('This morning after breakfast. It comes and goes.')).toBe('34-year-old female with “Sore throat and fever since Sunday”, started this morning after breakfast.');
    expect(briefingFor('I think Tuesday')).toMatch(/started I think Tuesday\.$/);
    expect(briefingFor('Monday night!')).toMatch(/started Monday night\.$/);
  });

  it('uses the model case summary only when given one', () => {
    expect(buildClinicHandoff(input()).caseSummary).toMatch(/^Chief concern: Sore throat and fever since Sunday\./);
    expect(buildClinicHandoff(input({ modelCaseSummary: 'Model summary.' })).caseSummary).toBe('Model summary.');
  });

  it('gives the same output for the same input', () => {
    expect(buildClinicHandoff(input())).toEqual(buildClinicHandoff(input()));
  });
});
