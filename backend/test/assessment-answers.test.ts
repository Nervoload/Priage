import { describe, expect, it } from 'vitest';

import { AnswerError, normalizeAnswer, sameAnswer, type AnswerSpec } from '../src/modules/assessment/case/answers';

const spec = (overrides: Partial<AnswerSpec> = {}): AnswerSpec => ({
  format: 'boolean', choices: [], choiceKeys: [], allowNotSure: true, noneOption: false, ...overrides,
});

const french = spec({ format: 'single_select', choices: ['Ça s’améliore', 'Ça empire rapidement'], choiceKeys: ['Getting better', 'Getting worse quickly'] });

describe('normalizeAnswer', () => {
  it('needs exactly one value, in the field the format expects', () => {
    expect(() => normalizeAnswer(spec(), {}, 'en')).toThrow(AnswerError);
    expect(() => normalizeAnswer(spec(), { valueBoolean: true, valueText: 'yes' }, 'en')).toThrow(AnswerError);
    expect(() => normalizeAnswer(spec(), { valueText: 'yes' }, 'en')).toThrow(AnswerError);
  });

  it('records yes/no in English and in the patient’s language', () => {
    expect(normalizeAnswer(spec(), { valueBoolean: true }, 'fr')).toMatchObject({ answerText: 'Yes', originalText: 'Oui', valueBoolean: true, notSure: false });
    expect(normalizeAnswer(spec(), { valueBoolean: false }, 'en')).toMatchObject({ answerText: 'No', originalText: 'No' });
  });

  it('accepts "Not sure" as a flag or as the shown label, only when offered', () => {
    expect(normalizeAnswer(spec(), { notSure: true }, 'fr')).toEqual({ answerText: 'Not sure', originalText: 'Je ne sais pas', notSure: true });
    expect(normalizeAnswer(spec({ format: 'single_select', choices: ['A', 'B'], choiceKeys: ['A', 'B'] }), { valueChoice: 'Not sure' }, 'en').notSure).toBe(true);
    expect(() => normalizeAnswer(spec({ allowNotSure: false }), { notSure: true }, 'en')).toThrow('Please choose an answer.');
  });

  it('maps a shown choice back to its English key', () => {
    expect(normalizeAnswer(french, { valueChoice: 'Ça empire rapidement' }, 'fr')).toMatchObject({ answerText: 'Getting worse quickly', originalText: 'Ça empire rapidement', valueChoice: 'Getting worse quickly' });
    expect(() => normalizeAnswer(french, { valueChoice: 'Getting worse quickly' }, 'fr')).toThrow('Choose one of the options shown.');
  });

  it('checks multi-select choices and keeps "None of these" alone', () => {
    const multi = spec({ format: 'multi_select', choices: ['Fièvre ou frissons', 'Toux'], choiceKeys: ['Fever or chills', 'Cough'], noneOption: true });
    expect(normalizeAnswer(multi, { valueChoices: ['Toux', 'Fièvre ou frissons'] }, 'fr')).toMatchObject({ answerText: 'Cough, Fever or chills', valueChoices: ['Cough', 'Fever or chills'] });
    expect(normalizeAnswer(multi, { valueChoices: ['Aucun de ceux-ci'] }, 'fr')).toMatchObject({ answerText: 'None of these', valueChoices: [] });
    expect(() => normalizeAnswer(multi, { valueChoices: ['Aucun de ceux-ci', 'Toux'] }, 'fr')).toThrow(AnswerError);
    expect(() => normalizeAnswer(multi, { valueChoices: [] }, 'fr')).toThrow(AnswerError);
    expect(() => normalizeAnswer(multi, { valueChoices: ['Toux', 'Toux'] }, 'fr')).toThrow(AnswerError);
  });

  it('keeps scales and numbers to whole numbers in range', () => {
    const scale = spec({ format: 'scale', scale: { min: 0, max: 10 } });
    expect(normalizeAnswer(scale, { valueNumber: 7 }, 'en')).toMatchObject({ answerText: '7', valueNumber: 7 });
    expect(() => normalizeAnswer(scale, { valueNumber: 11 }, 'en')).toThrow('Choose a number from 0 to 10.');
    expect(() => normalizeAnswer(scale, { valueNumber: 2.5 }, 'en')).toThrow(AnswerError);
    expect(normalizeAnswer(spec({ format: 'scale' }), { valueNumber: 10 }, 'en').valueNumber).toBe(10);
    expect(normalizeAnswer(spec({ format: 'number' }), { valueNumber: 42 }, 'en').answerText).toBe('42');
    expect(() => normalizeAnswer(spec({ format: 'number' }), { valueNumber: -1 }, 'en')).toThrow(AnswerError);
  });

  it('writes durations as "… ago" in both languages', () => {
    const duration = spec({ format: 'duration' });
    expect(normalizeAnswer(duration, { valueDuration: { amount: 3, unit: 'days' } }, 'fr')).toMatchObject({ answerText: '3 days ago', originalText: 'il y a 3 jours', valueDuration: { amount: 3, unit: 'days' } });
    expect(normalizeAnswer(duration, { valueDuration: { amount: 1, unit: 'hours' } }, 'en').answerText).toBe('1 hour ago');
    expect(() => normalizeAnswer(duration, { valueDuration: { amount: 3, unit: 'fortnights' } }, 'en')).toThrow(AnswerError);
    expect(() => normalizeAnswer(duration, { valueDuration: { amount: 1000, unit: 'days' } }, 'en')).toThrow(AnswerError);
  });

  it('trims text and applies the length limit', () => {
    const short = spec({ format: 'text', maxLength: 60 });
    expect(normalizeAnswer(short, { valueText: '  left calf  ' }, 'en')).toMatchObject({ answerText: 'left calf', valueText: 'left calf' });
    expect(() => normalizeAnswer(short, { valueText: 'x'.repeat(61) }, 'en')).toThrow('Please keep it under 60 characters.');
    expect(() => normalizeAnswer(short, { valueText: '   ' }, 'en')).toThrow(AnswerError);
    expect(normalizeAnswer(spec({ format: 'textarea' }), { valueText: 'x'.repeat(4000) }, 'en').answerText).toHaveLength(4000);
  });

  it('treats a resubmitted identical answer as the same', () => {
    const first = normalizeAnswer(french, { valueChoice: 'Ça s’améliore' }, 'fr');
    expect(sameAnswer(first, normalizeAnswer(french, { valueChoice: 'Ça s’améliore' }, 'fr'))).toBe(true);
    expect(sameAnswer(first, normalizeAnswer(french, { valueChoice: 'Ça empire rapidement' }, 'fr'))).toBe(false);
  });
});
