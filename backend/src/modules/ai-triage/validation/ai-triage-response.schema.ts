import type {
  AiTriageInputType,
  AiTriageProviderOutput,
  AiTriageUrgency,
} from '../types/ai-triage.types';

export const AI_TRIAGE_RESPONSE_SCHEMA_NAME = 'ai_triage_next_question_v1';

export const AI_TRIAGE_RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'status',
    'question',
    'reasonForQuestion',
    'urgentReview',
    'urgencyReason',
    'patientMessage',
    'completionReason',
    'urgency',
    'redFlags',
    'briefing',
    'recommendedAction',
  ],
  properties: {
    status: { type: 'string', enum: ['ask_question', 'complete', 'urgent_review'] },
    question: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['prompt', 'inputType', 'choices', 'helpText', 'allowsOther', 'required', 'topic'],
          properties: {
            prompt: { type: 'string' },
            inputType: { type: 'string', enum: ['text', 'textarea', 'number', 'boolean', 'single_select'] },
            choices: { type: 'array', items: { type: 'string' } },
            helpText: { type: 'string' },
            allowsOther: { type: 'boolean' },
            required: { type: 'boolean' },
            topic: { type: 'string' },
          },
        },
      ],
    },
    reasonForQuestion: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    urgentReview: { type: 'boolean' },
    urgencyReason: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    patientMessage: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    completionReason: { type: 'string' },
    urgency: { type: 'string', enum: ['low', 'medium', 'high', 'emergency'] },
    redFlags: { type: 'array', items: { type: 'string' } },
    briefing: { type: 'string' },
    recommendedAction: { type: 'string' },
  },
};

export function parseAiTriageProviderOutput(raw: string): AiTriageProviderOutput | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      (value.status !== 'ask_question' && value.status !== 'complete' && value.status !== 'urgent_review')
      || typeof value.completionReason !== 'string'
      || (typeof value.reasonForQuestion !== 'string' && value.reasonForQuestion !== null)
      || typeof value.urgentReview !== 'boolean'
      || (typeof value.urgencyReason !== 'string' && value.urgencyReason !== null)
      || (typeof value.patientMessage !== 'string' && value.patientMessage !== null)
      || !isUrgency(value.urgency)
      || typeof value.briefing !== 'string'
      || typeof value.recommendedAction !== 'string'
      || !Array.isArray(value.redFlags)
      || !value.redFlags.every((entry) => typeof entry === 'string')
    ) {
      return null;
    }

    const question = value.question === null ? null : parseQuestion(value.question);
    if (value.question !== null && !question) {
      return null;
    }
    if (value.status === 'ask_question' && !question) {
      return null;
    }
    if (value.status !== 'ask_question' && question) return null;
    if (value.status === 'urgent_review' && value.urgentReview !== true) return null;

    return {
      status: value.status,
      question,
      shouldComplete: value.status === 'complete',
      completionReason: value.completionReason.trim(),
      reasonForQuestion: typeof value.reasonForQuestion === 'string' ? value.reasonForQuestion.trim() : null,
      urgentReview: value.urgentReview,
      urgencyReason: typeof value.urgencyReason === 'string' ? value.urgencyReason.trim() : null,
      patientMessage: typeof value.patientMessage === 'string' ? value.patientMessage.trim() : null,
      urgency: value.urgency,
      redFlags: dedupe(value.redFlags as string[]),
      briefing: value.briefing.trim(),
      recommendedAction: value.recommendedAction.trim(),
    };
  } catch {
    return null;
  }
}

function parseQuestion(value: unknown): AiTriageProviderOutput['question'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const question = value as Record<string, unknown>;
  if (
    typeof question.prompt !== 'string'
    || !isInputType(question.inputType)
    || !Array.isArray(question.choices)
    || !question.choices.every((entry) => typeof entry === 'string')
    || typeof question.helpText !== 'string'
    || typeof question.allowsOther !== 'boolean'
    || typeof question.required !== 'boolean'
    || typeof question.topic !== 'string'
  ) {
    return null;
  }
  const prompt = question.prompt.trim();
  if (!prompt || prompt.length > 500) return null;
  return {
    prompt,
    inputType: question.inputType,
    choices: dedupe(question.choices as string[]).slice(0, 10),
    helpText: question.helpText.trim().slice(0, 500),
    allowsOther: question.allowsOther,
    required: question.required,
    topic: question.topic.trim().slice(0, 120),
  };
}

function isInputType(value: unknown): value is AiTriageInputType {
  return value === 'text' || value === 'textarea' || value === 'number'
    || value === 'boolean' || value === 'single_select';
}

function isUrgency(value: unknown): value is AiTriageUrgency {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'emergency';
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
