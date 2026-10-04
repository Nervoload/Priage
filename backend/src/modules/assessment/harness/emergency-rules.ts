import type { InterviewEmergencyAlert } from '../../intake/interview/triage-interview.types';
import type { NormalizedAnswer } from '../case/answers';
import { matchedOutcomes } from '../case/evidence';
import type { Language } from '../case/types';
import { EMERGENCY_ALERT } from '../packs/fixed-wording';
import type { HarnessQuestion } from './harness-types';
import { planOf } from './question-materializer';

// Code decides when the patient sees the emergency warning: a Yes to the
// safety question, or an answer the question's plan marks as an emergency
// (reviewed bank screens, and model questions, which may only raise urgency).
// Runs on every answer before anything else.

export interface EmergencyCheck {
  emergency: boolean;
  /** Staff-facing. Never sent to the patient. */
  reason: string;
}

export function checkEmergency(question: HarnessQuestion, answer: NormalizedAnswer): EmergencyCheck {
  if (question.source === 'safety') {
    return answer.valueBoolean === true ? { emergency: true, reason: 'Answered Yes to the immediate danger question.' } : { emergency: false, reason: '' };
  }
  const flagged = matchedOutcomes(planOf(question), answer).some((outcome) => outcome.emergency === true);
  return flagged
    ? { emergency: true, reason: `Answered “${answer.answerText}” to “${question.englishPrompt}”.` }
    : { emergency: false, reason: '' };
}

export function emergencyAlert(language: Language, reason: string, triggerQuestionId: string): InterviewEmergencyAlert {
  return { ...EMERGENCY_ALERT[language], reason, triggerQuestionId };
}
