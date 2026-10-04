import type { InterviewPhase, InterviewQuestion } from '../../intake/interview/triage-interview.types';
import { SAFETY_GATE_PUBLIC_ID } from '../../intake/interview/triage-interview.types';
import type { AnswerSpec } from '../case/answers';
import type { Audience, Language, PlannedQuestion } from '../case/types';
import { bankById } from '../packs';
import {
  followUpPrompt, NO, NONE_OF_THESE, NOT_SURE, PURPOSE_REASON, SAFETY_QUESTION, SCALE_ENDS, unitLabels, YES,
} from '../packs/fixed-wording';
import type { KnowledgePack } from '../packs/types';
import type { HarnessAnswerRecord, HarnessQuestion } from './harness-types';

// Turns planned questions into what the patient is shown, in their language
// and for whoever is answering. Code adds "Not sure", "None of these", scale
// ends and duration units; the model never writes them.

export interface MaterializeContext {
  pack: KnowledgePack;
  language: Language;
  audience: Audience;
}

/** Model-written short answers stay short; longer limits come from the bank. */
const MODEL_TEXT_LIMIT = 60;
const DEFAULT_TEXT_LIMIT = 1000;
const LONG_TEXT_LIMIT = 4000;

export const questionId = (key: string) => `hq_${key}`;

/** Care groups answers by stage through the legacy phase. */
export function phaseFor(plan: PlannedQuestion, pack: KnowledgePack): InterviewPhase {
  const bank = plan.bankId ? bankById(pack, plan.bankId) : null;
  if (bank?.role === 'core' || plan.purpose === 'danger') return 'urgent';
  if (plan.purpose === 'clarify' || plan.purpose === 'distinguish') return 'emergent';
  return 'history';
}

function labels(language: Language) {
  return { notSureLabel: NOT_SURE[language], noneLabel: NONE_OF_THESE[language] };
}

export function materialize(plan: PlannedQuestion, ctx: MaterializeContext): HarnessQuestion {
  const bank = plan.bankId ? bankById(ctx.pack, plan.bankId) : null;
  // Only reviewed bank wording exists in French so far; model questions are shown in English until translated.
  const language: Language = bank ? ctx.language : 'en';
  const prompt = bank ? bank.wording[language][ctx.audience] : plan.text;
  const englishPrompt = bank ? bank.wording.en[ctx.audience] : plan.text;

  let choices: string[] = [];
  let choiceKeys: string[] = [];
  if (plan.format === 'boolean') {
    choices = [YES[language], NO[language]];
    choiceKeys = [YES.en, NO.en];
  } else if (plan.format === 'single_select' || plan.format === 'multi_select') {
    choiceKeys = [...(plan.choices ?? [])];
    choices = bank?.choices ? bank.choices.map((choice) => choice[language]) : [...choiceKeys];
  }

  const maxLength = bank?.maxLength
    ?? (plan.format === 'textarea' ? LONG_TEXT_LIMIT : plan.format === 'text' ? (plan.source === 'model' ? MODEL_TEXT_LIMIT : DEFAULT_TEXT_LIMIT) : undefined);

  return {
    publicId: questionId(plan.key),
    phase: phaseFor(plan, ctx.pack),
    inputType: plan.format,
    prompt,
    englishPrompt,
    helpText: bank?.help?.[language] ?? '',
    placeholder: '',
    required: true,
    choices,
    choiceKeys,
    clinicalReason: PURPOSE_REASON[plan.purpose][language],
    askIfAmbiguous: false,
    language,
    machineTranslated: false,
    allowNotSure: plan.allowNotSure,
    ...labels(language),
    noneOption: plan.format === 'multi_select',
    ...(plan.format === 'scale' ? { scale: { min: plan.scale?.min ?? 0, max: plan.scale?.max ?? 10, minLabel: SCALE_ENDS[language].min, maxLabel: SCALE_ENDS[language].max } } : {}),
    ...(plan.format === 'duration' ? { units: unitLabels(language) } : {}),
    ...(maxLength ? { maxLength } : {}),
    source: plan.source === 'bank' ? 'bank' : plan.source,
    ...(plan.element ? { element: plan.element } : {}),
    ...(bank?.bankKey ? { bankKey: bank.bankKey } : {}),
    plan,
  };
}

export function safetyQuestion(language: Language, audience: Audience): HarnessQuestion {
  return {
    publicId: SAFETY_GATE_PUBLIC_ID,
    phase: 'urgent',
    inputType: 'boolean',
    prompt: SAFETY_QUESTION.prompt[language][audience],
    englishPrompt: SAFETY_QUESTION.prompt.en[audience],
    helpText: SAFETY_QUESTION.help[language][audience],
    placeholder: '',
    required: true,
    choices: [YES[language], NO[language]],
    choiceKeys: [YES.en, NO.en],
    clinicalReason: language === 'fr' ? 'Vérification de sécurité immédiate avant les autres questions.' : 'Immediate life-threatening check before the dynamic interview begins.',
    askIfAmbiguous: false,
    language,
    machineTranslated: false,
    allowNotSure: false,
    ...labels(language),
    noneOption: false,
    source: 'safety',
  };
}

/** A clinic's own question, as the clinic wrote it. */
export function clinicQuestion(question: InterviewQuestion, language: Language): HarnessQuestion {
  return {
    ...question,
    englishPrompt: question.prompt,
    // Clinics write their questions in English; they're shown as written until translation exists.
    language: 'en',
    machineTranslated: false,
    choiceKeys: [...question.choices],
    allowNotSure: false,
    ...labels(language),
    noneOption: false,
    ...(question.inputType === 'text' ? { maxLength: 1000 } : {}),
    source: 'clinic',
  };
}

/** The one gentle follow-up a vague free-text answer gets, in the patient's language. */
export function followUpQuestion(answer: HarnessAnswerRecord, original: PlannedQuestion | undefined, n: number, ctx: MaterializeContext): HarnessQuestion {
  const plan: PlannedQuestion = {
    key: `fu.${n}`,
    text: followUpPrompt(answer.answerText, 'en'),
    format: 'text',
    purpose: original?.purpose ?? 'clarify',
    ...(original?.element ? { element: original.element } : {}),
    targets: original ? [...original.targets] : [],
    ifAnswered: [],
    patientCanAnswer: 'yes',
    burden: 'low',
    allowNotSure: true,
    source: 'follow_up',
  };
  const question = materialize(plan, ctx);
  return { ...question, prompt: followUpPrompt(answer.originalText, ctx.language), language: ctx.language, notSureLabel: NOT_SURE[ctx.language], noneLabel: NONE_OF_THESE[ctx.language], clinicalReason: PURPOSE_REASON[plan.purpose][ctx.language], maxLength: 200 };
}

export function specOf(question: HarnessQuestion): AnswerSpec {
  return {
    format: question.inputType,
    choices: question.choices,
    choiceKeys: question.choiceKeys,
    allowNotSure: question.allowNotSure,
    noneOption: question.noneOption,
    ...(question.scale ? { scale: { min: question.scale.min, max: question.scale.max } } : {}),
    ...(question.maxLength ? { maxLength: question.maxLength } : {}),
  };
}

/** The plan behind a served question; safety and clinic questions get a plain one so their answers still become evidence. */
export function planOf(question: HarnessQuestion): PlannedQuestion {
  return question.plan ?? {
    key: question.publicId,
    text: question.englishPrompt,
    format: question.inputType,
    ...(question.choiceKeys.length && question.inputType !== 'boolean' ? { choices: question.choiceKeys } : {}),
    purpose: question.source === 'safety' ? 'danger' : 'history',
    targets: [],
    ifAnswered: [],
    patientCanAnswer: 'yes',
    burden: 'low',
    allowNotSure: question.allowNotSure,
    source: 'bank',
  };
}
