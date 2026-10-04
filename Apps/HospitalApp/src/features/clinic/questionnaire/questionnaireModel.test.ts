import { describe, expect, it } from 'vitest';
import type { ClinicQuestion } from '../../../shared/api/clinicQuestionnaire';
import { missingDefaults, moveQuestion, newQuestion, normalizeQuestions, questionCountWords, questionProblems, sameQuestions, withInputType } from './questionnaireModel';

const travel: ClinicQuestion = { key: 'travel_14d', origin: 'default', prompt: 'Have you travelled outside Canada in the last 14 days?', helpText: null, inputType: 'boolean', choices: [] };
const referral: ClinicQuestion = { key: 'referral', origin: 'custom', prompt: 'How did you hear about us?', helpText: null, inputType: 'single_select', choices: ['Friend', 'Search'] };

describe('questionnaire model', () => {
  it('adds custom questions with keys that don’t clash', () => {
    const values = [0, 0, 0.5];
    const first = newQuestion([{ ...travel, key: 'q_000000' }], () => values.shift() ?? 0.5);
    expect(first.key).toMatch(/^q_[a-z0-9]{6}$/);
    expect(first.key).not.toBe('q_000000');
    expect(first).toMatchObject({ origin: 'custom', inputType: 'boolean', choices: [] });
  });

  it('moves questions within bounds', () => {
    expect(moveQuestion([travel, referral], 0, 1).map((question) => question.key)).toEqual(['referral', 'travel_14d']);
    const list = [travel, referral];
    expect(moveQuestion(list, 0, -1)).toBe(list);
  });

  it('starts one-choice questions with two empty choices and clears them otherwise', () => {
    expect(withInputType(travel, 'single_select').choices).toEqual(['', '']);
    expect(withInputType(referral, 'single_select')).toBe(referral);
    expect(withInputType(referral, 'text').choices).toEqual([]);
    expect(withInputType({ ...referral, inputType: 'text', choices: ['Kept'] }, 'single_select').choices).toEqual(['Kept']);
  });

  it('explains what needs fixing before publishing', () => {
    expect(questionProblems(travel)).toEqual([]);
    expect(questionProblems({ ...travel, prompt: 'Hi' })).toEqual(['Write the question (at least 5 characters).']);
    expect(questionProblems({ ...travel, prompt: 'x'.repeat(201), helpText: 'y'.repeat(201) })).toHaveLength(2);
    expect(questionProblems({ ...referral, choices: ['Only', ' '] })).toEqual(['Give 2 to 6 choices.']);
    expect(questionProblems({ ...referral, choices: ['Yes', 'yes'] })).toEqual(['Each choice needs to be different.']);
    expect(questionProblems({ ...referral, choices: ['x'.repeat(81), 'b'] })).toEqual(['Keep each choice under 80 characters.']);
  });

  it('compares drafts the way the server will store them', () => {
    expect(normalizeQuestions([{ ...referral, prompt: '  How  did you hear about us? ', helpText: ' ', choices: ['Friend ', '', 'Search'] }])).toEqual([referral]);
    expect(sameQuestions([{ ...travel, prompt: `${travel.prompt} ` }], [travel])).toBe(true);
    expect(sameQuestions([travel], [travel, referral])).toBe(false);
  });

  it('offers removed defaults back and counts plainly', () => {
    expect(missingDefaults([referral], [travel])).toEqual([travel]);
    expect(missingDefaults([travel], [travel])).toEqual([]);
    expect(questionCountWords(0)).toBe('no questions');
    expect(questionCountWords(1)).toBe('1 question');
    expect(questionCountWords(3)).toBe('3 questions');
  });
});
