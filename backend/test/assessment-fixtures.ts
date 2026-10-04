import { normalizeAnswer, type AnswerInput, type AnswerSpec } from '../src/modules/assessment/case/answers';
import { initialCase, type CaseSeed } from '../src/modules/assessment/case/case-builder';
import { recordAnswer } from '../src/modules/assessment/case/evidence';
import type { Case, CommunicationNeeds, PlannedQuestion } from '../src/modules/assessment/case/types';
import { bankById, bankToPlanned } from '../src/modules/assessment/packs';
import { UNCLEAR_PACK } from '../src/modules/assessment/packs/unclear.pack';

export const pack = UNCLEAR_PACK;

export function communication(overrides: Partial<CommunicationNeeds> = {}): CommunicationNeeds {
  return { language: 'en', readingLevel: 'standard', answeredBy: 'self', subjectAge: null, input: [], ...overrides };
}

export function seed(overrides: Partial<CaseSeed> = {}): CaseSeed {
  return {
    complaint: 'Growing purple spot on my leg, hot, spreading fast',
    note: null,
    patient: { age: 34, sex: 'male' },
    communication: communication(),
    ...overrides,
  };
}

export function startCase(overrides: Partial<CaseSeed> = {}): Case {
  return initialCase(seed(overrides), pack);
}

/** The English answer spec for a planned question, as the materializer would build it for an English patient. */
export function specFor(question: PlannedQuestion): AnswerSpec {
  return {
    format: question.format,
    choices: question.choices ?? [],
    choiceKeys: question.choices ?? [],
    allowNotSure: question.allowNotSure,
    noneOption: question.format === 'multi_select',
    scale: question.scale,
  };
}

export function bankQuestion(id: string): PlannedQuestion {
  const question = bankById(pack, id);
  if (!question) throw new Error(`No bank question ${id}`);
  return bankToPlanned(question);
}

/** Answers a question in English and records it, with answer id `a<n>` by default. */
export function answer(current: Case, question: PlannedQuestion, input: AnswerInput, answerId = `a${current.asked.length + 1}`): Case {
  const normalized = normalizeAnswer(specFor(question), input, 'en');
  return recordAnswer(current, question, normalized, { answerId, language: 'en', answeredBy: current.communication.answeredBy });
}

export function modelQuestion(overrides: Partial<PlannedQuestion> = {}): PlannedQuestion {
  return {
    key: 'm1.1',
    text: 'Did anything hit or injure your leg in the last week?',
    format: 'boolean',
    purpose: 'distinguish',
    targets: ['other:bruise'],
    ifAnswered: [
      { answer: 'Yes', effects: [{ target: 'other:bruise', shift: 'supports' }] },
      { answer: 'No', effects: [{ target: 'other:bruise', shift: 'weakens' }] },
    ],
    patientCanAnswer: 'yes',
    burden: 'low',
    allowNotSure: true,
    source: 'model',
    ...overrides,
  };
}
