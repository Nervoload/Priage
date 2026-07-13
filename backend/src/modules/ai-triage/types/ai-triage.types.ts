export type AiTriageStatus = 'in_progress' | 'ready_to_complete' | 'urgent_review' | 'submitted';
export type AiTriageInputType = 'text' | 'textarea' | 'number' | 'boolean' | 'single_select';
export type AiTriageUrgency = 'low' | 'medium' | 'high' | 'emergency';
export type AiTriageProviderName = 'openai' | 'anthropic' | 'fallback';

export interface AiTriageMandatoryAnswers {
  onset: string;
  severity: number | 'unknown' | 'prefer_not_to_answer';
  progression: 'better' | 'worse' | 'same' | 'unknown';
  relevantHistory: string;
}

export interface AiTriageQuestion {
  id: string;
  prompt: string;
  inputType: AiTriageInputType;
  choices: string[];
  helpText: string;
  allowsOther: boolean;
  required: boolean;
  topic: string;
}

export interface AiTriageAnswer {
  questionId: string;
  question: string;
  topic: string;
  answer: string;
  answeredAt: string;
}

export interface AiTriageSummary {
  chiefComplaint: string;
  originalChiefComplaint: string;
  onset: string;
  severity: string;
  progression: string;
  relevantSymptoms: string[];
  relevantNegatives: string[];
  medicalHistory: string[];
  medications: string[];
  allergies: string[];
  additionalContext: string[];
  unansweredImportantQuestions: string[];
  urgentWarningSigns: string[];
  urgency: AiTriageUrgency;
  redFlags: string[];
  briefing: string;
  recommendedAction: string;
}

export interface AiTriageState {
  sessionId: string;
  status: AiTriageStatus;
  questionCount: number;
  maxQuestions: number;
  currentQuestion: AiTriageQuestion | null;
  chiefComplaint: string;
  mandatoryAnswers: AiTriageMandatoryAnswers;
  answers: AiTriageAnswer[];
  summary: AiTriageSummary;
  provider: AiTriageProviderName;
  completionReason: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface AiTriagePatientContext {
  age: number | null;
  gender: string | null;
  chiefComplaint: string | null;
  details: string | null;
  allergies: string | null;
  conditions: string | null;
}

export interface AiTriageGenerationInput {
  patient: AiTriagePatientContext;
  mandatoryAnswers: AiTriageMandatoryAnswers;
  answers: AiTriageAnswer[];
  questionCount: number;
  maxQuestions: number;
  previousQuestions: string[];
}

export interface AiTriageProviderOutput {
  status: 'ask_question' | 'complete' | 'urgent_review';
  question: Omit<AiTriageQuestion, 'id'> | null;
  shouldComplete: boolean;
  completionReason: string;
  reasonForQuestion: string | null;
  urgentReview: boolean;
  urgencyReason: string | null;
  patientMessage: string | null;
  urgency: AiTriageUrgency;
  redFlags: string[];
  briefing: string;
  recommendedAction: string;
}

export interface AiTriageProviderResult {
  output: AiTriageProviderOutput;
  provider: Exclude<AiTriageProviderName, 'fallback'>;
  model: string;
  responseId: string;
}

export const AI_TRIAGE_MAX_QUESTIONS = 12;

export interface AiTriageClientResponse {
  sessionId: string;
  status: 'ask_question' | 'complete' | 'urgent_review' | 'submitted';
  question: {
    id: string;
    text: string;
    inputType: AiTriageInputType;
    options: string[];
    allowsOther: boolean;
    required: boolean;
    helpText: string;
  } | null;
  reasonForQuestion: string | null;
  urgentReview: boolean;
  urgencyReason: string | null;
  patientMessage: string | null;
  summary: AiTriageSummary;
  chiefComplaint: string;
  mandatoryAnswers: AiTriageMandatoryAnswers;
  answers: AiTriageAnswer[];
  questionCount: number;
  maxQuestions: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}
