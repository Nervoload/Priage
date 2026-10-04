import { describe, expect, it } from 'vitest';

import { causeTerms, normalizeLabel, wholeWord } from '../src/modules/assessment/case/audit';
import { initialCase } from '../src/modules/assessment/case/case-builder';
import { checkQuestion, MAX_QUESTION_LENGTH } from '../src/modules/assessment/case/question-checks';
import { HISTORY_ELEMENTS } from '../src/modules/assessment/case/types';
import { applies, bankById, bankToPlanned, DEFAULT_PACK_ID, packById } from '../src/modules/assessment/packs';
import { audienceFor, durationWords, EMERGENCY_ALERT, FIXED_WORDING_REVIEWED, followUpPrompt, PURPOSE_REASON, SAFETY_QUESTION, unitLabels } from '../src/modules/assessment/packs/fixed-wording';
import { seed } from './assessment-fixtures';

const pack = packById(DEFAULT_PACK_ID);
const LANGUAGES = ['en', 'fr'] as const;
const AUDIENCES = ['self', 'child', 'other'] as const;

describe('the unclear pack', () => {
  it('is marked unreviewed until the clinical owner approves it', () => {
    expect(pack.reviewed).toBe(false);
    expect(pack.approvedBy).toBeNull();
    expect(FIXED_WORDING_REVIEWED).toBe(false);
  });

  it('has unique ids and every reference resolves', () => {
    expect(new Set(pack.bank.map((question) => question.id)).size).toBe(pack.bank.length);
    expect(new Set(pack.causes.map((cause) => cause.id)).size).toBe(pack.causes.length);
    for (const cause of pack.causes) for (const id of cause.screenBankIds) expect(bankById(pack, id), `${cause.id} → ${id}`).not.toBeNull();
    for (const id of [...pack.order.core, ...pack.order.fillers, pack.order.closing]) expect(bankById(pack, id), id).not.toBeNull();
    expect(() => packById('nope')).toThrow('Unknown knowledge pack');
  });

  it('words every question for every language and audience, within the length limit', () => {
    for (const question of pack.bank) {
      for (const language of LANGUAGES) {
        for (const audience of AUDIENCES) {
          const text = question.wording[language][audience];
          expect(text.trim(), `${question.id} ${language}/${audience}`).not.toBe('');
          expect(text.length, `${question.id} ${language}/${audience}`).toBeLessThanOrEqual(MAX_QUESTION_LENGTH);
        }
      }
      for (const choice of question.choices ?? []) expect(choice.en && choice.fr, question.id).toBeTruthy();
      if (question.help) expect(question.help.en && question.help.fr, question.id).toBeTruthy();
    }
  });

  it('never names a cause in a question', () => {
    const terms = causeTerms(pack, []);
    for (const question of pack.bank) {
      for (const audience of AUDIENCES) {
        const text = normalizeLabel(question.wording.en[audience]);
        expect(terms.filter((term) => wholeWord(text, term)), `${question.id}/${audience}`).toEqual([]);
      }
    }
  });

  it('passes the same checks as model questions, and covers every answer with an outcome', () => {
    const current = initialCase(seed(), pack);
    for (const question of pack.bank) {
      const planned = bankToPlanned(question);
      expect(checkQuestion(planned, { current, causeTerms: causeTerms(pack, []), allowLongText: question.role === 'closing' }), question.id).toEqual([]);
    }
  });

  it('only interrupts with an emergency from danger screens', () => {
    const emergencies = pack.bank.filter((question) => question.ifAnswered.some((outcome) => outcome.emergency));
    expect(emergencies.map((question) => question.id).sort()).toEqual(['s.airway', 's.breathing', 's.stroke', 's.thunderclap']);
    expect(emergencies.every((question) => question.role === 'screen')).toBe(true);
  });

  it('keeps the wording Care rules recognise', () => {
    expect(bankById(pack, 'u.severity')?.wording.en.self).toMatch(/0 to 10/);
    expect(bankById(pack, 'u.onset')?.wording.en.child).toMatch(/how long/i);
    expect(bankById(pack, 'u.worse_activity')?.wording.en.self).toMatch(/worse with activity/);
    expect(bankById(pack, 'u.medications')?.wording.en.self).toMatch(/medicine/);
    expect(bankById(pack, 'u.allergies')?.wording.en.self).toMatch(/allerg/);
    // "What have you tried" must not look like the medications question to Care's rules.
    expect(bankById(pack, 'u.tried')?.wording.en.self).not.toMatch(/medication|medicine|pills/);
  });

  it('covers every core history element with a bank question', () => {
    const elements = new Set(pack.bank.map((question) => question.element));
    for (const element of pack.coreHistory) {
      expect(HISTORY_ELEMENTS).toContain(element);
      expect(elements.has(element), element).toBe(true);
    }
  });

  it('gates questions by sex, age and audience', () => {
    const pregnancy = bankById(pack, 'u.pregnancy')!;
    expect(applies(pregnancy.when, { age: 30, sex: 'female', audience: 'self' })).toBe(true);
    expect(applies(pregnancy.when, { age: 30, sex: 'male', audience: 'self' })).toBe(false);
    expect(applies(pregnancy.when, { age: 70, sex: 'female', audience: 'self' })).toBe(false);
    expect(applies(pregnancy.when, { age: 10, sex: 'female', audience: 'self' })).toBe(false);
    expect(applies(pregnancy.when, { age: 30, sex: 'female', audience: 'child' })).toBe(false);
    expect(applies(pregnancy.when, { age: null, sex: null, audience: 'self' })).toBe(true);
    expect(applies(undefined, { age: null, sex: null, audience: 'other' })).toBe(true);
  });
});

describe('fixed wording', () => {
  it('has the safety question and emergency alert in both languages', () => {
    for (const language of LANGUAGES) {
      for (const audience of AUDIENCES) expect(SAFETY_QUESTION.prompt[language][audience]).toMatch(/\?$/);
      expect(EMERGENCY_ALERT[language].body).toMatch(/911/);
    }
    expect(SAFETY_QUESTION.prompt.en.self).toBe('Are you in immediate danger right now?');
  });

  it('writes durations and units in each language', () => {
    expect(durationWords(1, 'days', 'en')).toBe('1 day');
    expect(durationWords(0, 'days', 'en')).toBe('0 days');
    expect(durationWords(0, 'days', 'fr')).toBe('0 jour');
    expect(durationWords(3, 'months', 'fr')).toBe('3 mois');
    expect(unitLabels('fr').years).toBe('ans');
  });

  it('gives model questions a safe "why we ask" and vague answers one follow-up', () => {
    expect(PURPOSE_REASON.danger.en).not.toMatch(/danger|emergency/i);
    expect(followUpPrompt('kind of', 'en')).toBe('You answered “kind of”. Could you tell us a little more?');
    expect(followUpPrompt('bof', 'fr')).toContain('« bof »');
    expect(followUpPrompt('x'.repeat(100), 'en')).toContain('x'.repeat(60) + '”');
  });

  it('maps who is answering to a wording audience', () => {
    expect([audienceFor('self'), audienceFor('parent'), audienceFor('caregiver'), audienceFor('other')]).toEqual(['self', 'child', 'other', 'other']);
  });
});
