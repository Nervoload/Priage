import { describe, expect, it } from 'vitest';
import { answerFor, type ClinicQuestion } from './clinicQuestions';

const question = (inputType: ClinicQuestion['inputType'], choices: string[] = []): ClinicQuestion => ({ key: 'q', prompt: 'Question?', helpText: null, inputType, choices });

describe('clinic question answers', () => {
  it('turns each field into the answer the clinic expects', () => {
    expect(answerFor(question('boolean'), 'Yes')).toEqual({ key: 'q', valueBoolean: true });
    expect(answerFor(question('boolean'), 'No')).toEqual({ key: 'q', valueBoolean: false });
    expect(answerFor(question('single_select', ['Friend', 'Search']), 'Search')).toEqual({ key: 'q', valueChoice: 'Search' });
    expect(answerFor(question('text'), '  Side door ')).toEqual({ key: 'q', valueText: 'Side door' });
  });

  it('treats blank or unlisted answers as unanswered', () => {
    expect(answerFor(question('text'), '   ')).toBeNull();
    expect(answerFor(question('boolean'), undefined)).toBeNull();
    expect(answerFor(question('boolean'), 'Maybe')).toBeNull();
    expect(answerFor(question('single_select', ['Friend']), 'Billboard')).toBeNull();
  });
});
