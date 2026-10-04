import type { InterviewPhase, ProviderQuestionDraft } from './triage-interview.types';

// The fixed question bank the deterministic fallback asks from. Clinic Care
// rules recognize these questions by key (see RESCUE_BANK_KEY_BY_PROMPT), so
// changing a prompt here changes what those rules can match.
export const RESCUE_QUESTION_BANK: Readonly<Record<InterviewPhase, readonly ProviderQuestionDraft[]>> = {
  urgent: [
    {
      phase: 'urgent',
      inputType: 'text',
      prompt: 'When did this start, and how quickly did it become this bad?',
      helpText: 'A short timeline helps staff understand urgency.',
      placeholder: 'e.g. started 2 hours ago and worsened over 20 minutes',
      required: true,
      choices: [],
      clinicalReason: 'Onset and time course affect acuity.',
      askIfAmbiguous: true,
    },
    {
      phase: 'urgent',
      inputType: 'number',
      prompt: 'How severe is it right now on a scale from 0 to 10?',
      helpText: '0 means no symptom and 10 is the worst imaginable.',
      placeholder: '0-10',
      required: true,
      choices: [],
      clinicalReason: 'Severity helps prioritize acuity.',
      askIfAmbiguous: false,
    },
    {
      phase: 'urgent',
      inputType: 'boolean',
      prompt: 'Is it getting rapidly worse, or are you having trouble breathing, heavy bleeding, or passing out?',
      helpText: 'Tell us if any of these are happening now.',
      placeholder: '',
      required: true,
      choices: ['Yes', 'No'],
      clinicalReason: 'Generic red-flag rescue screen.',
      askIfAmbiguous: false,
    },
  ],
  emergent: [
    {
      phase: 'emergent',
      inputType: 'textarea',
      prompt: 'What other symptoms are happening with this right now?',
      helpText: 'A short list is enough.',
      placeholder: 'e.g. nausea, dizziness, fever, numbness',
      required: true,
      choices: [],
      clinicalReason: 'Associated symptoms help separate higher-risk patterns.',
      askIfAmbiguous: true,
    },
    {
      phase: 'emergent',
      inputType: 'text',
      prompt: 'Have you taken anything or done anything for this already today?',
      helpText: 'Include medication, inhalers, ice, rest, or anything else important.',
      placeholder: 'e.g. took Tylenol, used inhaler, nothing yet',
      required: false,
      choices: [],
      clinicalReason: 'Prior actions affect handoff and next questioning.',
      askIfAmbiguous: false,
    },
    {
      phase: 'emergent',
      inputType: 'boolean',
      prompt: 'Do you feel worse with activity, walking, or standing up?',
      helpText: 'A yes or no is enough.',
      placeholder: '',
      required: false,
      choices: ['Yes', 'No'],
      clinicalReason: 'Simple worsening/instability screen.',
      askIfAmbiguous: false,
    },
  ],
  history: [
    {
      phase: 'history',
      inputType: 'text',
      prompt: 'What medical conditions or past issues matter most for this problem?',
      helpText: 'A short list is enough.',
      placeholder: 'e.g. asthma, diabetes, migraines, none',
      required: false,
      choices: [],
      clinicalReason: 'Relevant history improves handoff quality.',
      askIfAmbiguous: true,
    },
    {
      phase: 'history',
      inputType: 'text',
      prompt: 'What medications or allergies should the care team know about right now?',
      helpText: 'Include daily medications and important allergies.',
      placeholder: 'e.g. insulin, blood thinner, penicillin allergy, none',
      required: false,
      choices: [],
      clinicalReason: 'Medication and allergy context supports safer intake.',
      askIfAmbiguous: false,
    },
    {
      phase: 'history',
      inputType: 'textarea',
      prompt: 'Anything else important the care team should know before your visit?',
      helpText: 'Include pregnancy context, recent surgery, or a major concern if relevant.',
      placeholder: 'Short note',
      required: false,
      choices: [],
      clinicalReason: 'Captures final handoff details.',
      askIfAmbiguous: false,
    },
  ],
};

export type RescueBankKey =
  | 'urgent.timeline'
  | 'urgent.severity'
  | 'urgent.redflag_screen'
  | 'emergent.associated'
  | 'emergent.self_care'
  | 'emergent.worse_activity'
  | 'history.conditions'
  | 'history.meds_allergies'
  | 'history.other';

const KEYS_IN_ORDER: Record<InterviewPhase, RescueBankKey[]> = {
  urgent: ['urgent.timeline', 'urgent.severity', 'urgent.redflag_screen'],
  emergent: ['emergent.associated', 'emergent.self_care', 'emergent.worse_activity'],
  history: ['history.conditions', 'history.meds_allergies', 'history.other'],
};

export function normalizeBankPrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Normalized prompt → stable key. Older stored interviews use the same prompts. */
export const RESCUE_BANK_KEY_BY_PROMPT: ReadonlyMap<string, RescueBankKey> = new Map(
  (Object.keys(KEYS_IN_ORDER) as InterviewPhase[]).flatMap((phase) =>
    RESCUE_QUESTION_BANK[phase].map((question, index) => [normalizeBankPrompt(question.prompt), KEYS_IN_ORDER[phase][index]] as const)),
);

export function rescueBankKeyFor(prompt: string): RescueBankKey | null {
  return RESCUE_BANK_KEY_BY_PROMPT.get(normalizeBankPrompt(prompt)) ?? null;
}
