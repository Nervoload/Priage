import { durationWords, NO, NONE_OF_THESE, NOT_SURE, YES } from '../packs/fixed-wording';
import { DURATION_UNITS, type AssessmentInputType, type DurationUnit, type Language, type ScaleSpec } from './types';

/** What a served question accepts. Choices are shown in the patient's language; keys are the English canonical values. */
export interface AnswerSpec {
  format: AssessmentInputType;
  choices: string[];
  choiceKeys: string[];
  allowNotSure: boolean;
  /** Multi-select offers an exclusive "None of these". */
  noneOption: boolean;
  scale?: ScaleSpec;
  maxLength?: number;
}

export interface AnswerInput {
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueChoice?: string;
  valueChoices?: string[];
  valueDuration?: { amount: number; unit: string };
  notSure?: boolean;
}

export interface NormalizedAnswer {
  /** English canonical text. Care rules and the model read this. */
  answerText: string;
  /** What the patient chose or wrote, in their language. */
  originalText: string;
  notSure: boolean;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  /** English key. */
  valueChoice?: string;
  /** English keys; empty when "None of these" was chosen. */
  valueChoices?: string[];
  valueDuration?: { amount: number; unit: DurationUnit };
}

export class AnswerError extends Error {}

const DEFAULT_MAX_LENGTH: Partial<Record<AssessmentInputType, number>> = { text: 1000, textarea: 4000 };
const MAX_DURATION = 999;
const MAX_NUMBER = 100_000;

function providedFields(input: AnswerInput): string[] {
  const fields: string[] = [];
  if (input.valueText !== undefined) fields.push('valueText');
  if (input.valueNumber !== undefined) fields.push('valueNumber');
  if (input.valueBoolean !== undefined) fields.push('valueBoolean');
  if (input.valueChoice !== undefined) fields.push('valueChoice');
  if (input.valueChoices !== undefined) fields.push('valueChoices');
  if (input.valueDuration !== undefined) fields.push('valueDuration');
  if (input.notSure === true) fields.push('notSure');
  return fields;
}

const FIELD_FOR: Record<AssessmentInputType, string> = {
  text: 'valueText', textarea: 'valueText', number: 'valueNumber', scale: 'valueNumber', boolean: 'valueBoolean',
  single_select: 'valueChoice', multi_select: 'valueChoices', duration: 'valueDuration',
};

function keyFor(spec: AnswerSpec, shown: string): string {
  const index = spec.choices.indexOf(shown.trim());
  if (index < 0) throw new AnswerError('Choose one of the options shown.');
  return spec.choiceKeys[index] ?? spec.choices[index];
}

function notSure(language: Language): NormalizedAnswer {
  return { answerText: NOT_SURE.en, originalText: NOT_SURE[language], notSure: true };
}

/**
 * Validates one answer against the question it answers and returns the
 * English canonical form plus the patient's original. Throws AnswerError with
 * a message safe to show the patient.
 */
export function normalizeAnswer(spec: AnswerSpec, input: AnswerInput, language: Language): NormalizedAnswer {
  const fields = providedFields(input);
  if (fields.length !== 1) throw new AnswerError('An answer is required to continue.');
  const [field] = fields;

  // "Not sure" may arrive as its own flag or as the shown choice label.
  if (field === 'notSure' || (field === 'valueChoice' && spec.allowNotSure && input.valueChoice?.trim() === NOT_SURE[language])) {
    if (!spec.allowNotSure) throw new AnswerError('Please choose an answer.');
    return notSure(language);
  }
  if (field !== FIELD_FOR[spec.format]) throw new AnswerError('An answer is required to continue.');

  switch (spec.format) {
    case 'boolean': {
      const value = input.valueBoolean as boolean;
      return { answerText: value ? YES.en : NO.en, originalText: value ? YES[language] : NO[language], notSure: false, valueBoolean: value };
    }
    case 'single_select': {
      const shown = (input.valueChoice ?? '').trim();
      const key = keyFor(spec, shown);
      return { answerText: key, originalText: shown, notSure: false, valueChoice: key };
    }
    case 'multi_select': {
      const shown = (input.valueChoices ?? []).map((choice) => choice.trim());
      if (!shown.length || new Set(shown).size !== shown.length) throw new AnswerError('Choose at least one option.');
      if (spec.noneOption && shown.includes(NONE_OF_THESE[language])) {
        if (shown.length > 1) throw new AnswerError('“None of these” can’t be combined with other options.');
        return { answerText: NONE_OF_THESE.en, originalText: NONE_OF_THESE[language], notSure: false, valueChoices: [] };
      }
      const keys = shown.map((choice) => keyFor(spec, choice));
      return { answerText: keys.join(', '), originalText: shown.join(', '), notSure: false, valueChoices: keys };
    }
    case 'scale': {
      const value = input.valueNumber as number;
      const { min, max } = spec.scale ?? { min: 0, max: 10 };
      if (!Number.isInteger(value) || value < min || value > max) throw new AnswerError(`Choose a number from ${min} to ${max}.`);
      return { answerText: String(value), originalText: String(value), notSure: false, valueNumber: value };
    }
    case 'number': {
      const value = input.valueNumber as number;
      if (!Number.isInteger(value) || value < 0 || value > MAX_NUMBER) throw new AnswerError('Enter a whole number.');
      return { answerText: String(value), originalText: String(value), notSure: false, valueNumber: value };
    }
    case 'duration': {
      const duration = input.valueDuration as { amount: number; unit: string };
      if (!Number.isInteger(duration.amount) || duration.amount < 0 || duration.amount > MAX_DURATION) throw new AnswerError('Enter how long, as a whole number.');
      if (!DURATION_UNITS.includes(duration.unit as DurationUnit)) throw new AnswerError('Choose minutes, hours, days, weeks, months or years.');
      const unit = duration.unit as DurationUnit;
      const english = `${durationWords(duration.amount, unit, 'en')} ago`;
      const original = language === 'fr' ? `il y a ${durationWords(duration.amount, unit, 'fr')}` : english;
      return { answerText: english, originalText: original, notSure: false, valueDuration: { amount: duration.amount, unit } };
    }
    case 'text':
    case 'textarea': {
      const text = (input.valueText ?? '').trim();
      if (!text) throw new AnswerError('An answer is required to continue.');
      const limit = spec.maxLength ?? DEFAULT_MAX_LENGTH[spec.format] ?? 1000;
      if (text.length > limit) throw new AnswerError(`Please keep it under ${limit} characters.`);
      // Free text stays in the patient's language until the reader translates it.
      return { answerText: text, originalText: text, notSure: false, valueText: text };
    }
  }
}

/** Two answers are the same submission when their canonical values match. Used to make retries idempotent. */
export function sameAnswer(left: NormalizedAnswer, right: NormalizedAnswer): boolean {
  return left.notSure === right.notSure && left.answerText === right.answerText && left.originalText === right.originalText;
}
