export const TRIAGE_INTERVIEW_RESPONSE_SCHEMA_NAME = 'triage_interview_batch_v2';

export const TRIAGE_INTERVIEW_RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'phase',
    'sessionGoal',
    'targetQuestionCount',
    'shouldComplete',
    'completionReason',
    'urgency',
    'redFlags',
    'recommendedAction',
    'summaryPreview',
    'interrupt',
    'questions',
  ],
  properties: {
    phase: {
      type: 'string',
      enum: ['urgent', 'emergent', 'history'],
    },
    sessionGoal: { type: 'string' },
    targetQuestionCount: { type: 'integer', minimum: 0, maximum: 12 },
    shouldComplete: { type: 'boolean' },
    completionReason: { type: 'string' },
    urgency: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'emergency'],
    },
    redFlags: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendedAction: { type: 'string' },
    summaryPreview: { type: 'string' },
    interrupt: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'title', 'body', 'recommendation', 'reason'],
      properties: {
        type: {
          type: 'string',
          enum: ['none', 'emergency_ack_required'],
        },
        title: { type: 'string' },
        body: { type: 'string' },
        recommendation: { type: 'string' },
        reason: { type: 'string' },
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'phase',
          'inputType',
          'prompt',
          'helpText',
          'placeholder',
          'required',
          'choices',
          'clinicalReason',
          'askIfAmbiguous',
        ],
        properties: {
          phase: {
            type: 'string',
            enum: ['urgent', 'emergent', 'history'],
          },
          inputType: {
            type: 'string',
            enum: ['text', 'textarea', 'number', 'boolean', 'single_select'],
          },
          prompt: { type: 'string' },
          helpText: { type: 'string' },
          placeholder: { type: 'string' },
          required: { type: 'boolean' },
          choices: {
            type: 'array',
            items: { type: 'string' },
          },
          clinicalReason: { type: 'string' },
          askIfAmbiguous: { type: 'boolean' },
        },
      },
    },
  },
};
