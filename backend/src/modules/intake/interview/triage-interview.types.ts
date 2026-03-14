export type InterviewPhase = 'urgent' | 'emergent' | 'history';
export type InterviewInputType = 'text' | 'textarea' | 'number' | 'boolean' | 'single_select';
export type InterviewStatus = 'in_progress' | 'emergency_ack_required' | 'complete';
export type InterviewUrgency = 'low' | 'medium' | 'high' | 'emergency';
export type InterviewGenerationMode = 'ai' | 'fallback';

export interface InterviewQuestion {
  publicId: string;
  phase: InterviewPhase;
  inputType: InterviewInputType;
  prompt: string;
  helpText?: string;
  placeholder?: string;
  required: boolean;
  choices: string[];
  clinicalReason?: string;
  askIfAmbiguous: boolean;
}

export interface InterviewEmergencyAlert {
  title: string;
  body: string;
  recommendation: string;
}

export interface InterviewAnswerValue {
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueChoice?: string;
}

export interface InterviewAnswerRecord extends InterviewAnswerValue {
  questionPublicId: string;
  phase: InterviewPhase;
  prompt: string;
  inputType: InterviewInputType;
  answeredAt: string;
  answerText: string;
}

export interface InterviewSummaryRecord {
  urgency: InterviewUrgency;
  redFlags: string[];
  recommendedAction: string;
  summaryPreview: string;
  combinedDetails: string;
}

export interface InterviewProviderState {
  providerName: 'openai';
  model: string;
  responseId: string;
  promptVersion: string;
}

export interface InterviewInterrupt {
  type: 'none' | 'emergency_ack_required';
  title: string;
  body: string;
  recommendation: string;
  reason: string;
}

export interface InterviewStateSnapshot {
  interviewPublicId: string;
  status: InterviewStatus;
  phase: InterviewPhase;
  askedCount: number;
  maxQuestions: number;
  currentQuestion: InterviewQuestion | null;
  cachedQuestions: InterviewQuestion[];
  pendingCandidates: InterviewQuestion[];
  emergencyAlert: InterviewEmergencyAlert | null;
  summaryPreview: string;
  answers: InterviewAnswerRecord[];
  emergencyAcknowledged: boolean;
  summaryRecord: InterviewSummaryRecord | null;
  sessionGoal: string;
  targetQuestionCount: number | null;
  completionReason: string;
  providerState: InterviewProviderState | null;
  generationMode: InterviewGenerationMode;
}

export interface InterviewClientState {
  interviewPublicId: string;
  status: InterviewStatus;
  phase: InterviewPhase;
  askedCount: number;
  maxQuestions: number;
  currentQuestion: InterviewQuestion | null;
  cachedQuestions: InterviewQuestion[];
  emergencyAlert: InterviewEmergencyAlert | null;
  summaryPreview: string;
}

export interface ProviderQuestionDraft {
  phase: InterviewPhase;
  inputType: InterviewInputType;
  prompt: string;
  helpText: string;
  placeholder: string;
  required: boolean;
  choices: string[];
  clinicalReason: string;
  askIfAmbiguous: boolean;
}

export interface ProviderInterviewResult {
  phase: InterviewPhase;
  sessionGoal: string;
  targetQuestionCount: number;
  shouldComplete: boolean;
  completionReason: string;
  urgency: InterviewUrgency;
  redFlags: string[];
  recommendedAction: string;
  summaryPreview: string;
  interrupt: InterviewInterrupt;
  questions: ProviderQuestionDraft[];
}

export interface ProviderGenerationResult {
  result: ProviderInterviewResult;
  providerState: InterviewProviderState;
}

export interface InterviewPatientContext {
  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  chiefComplaint?: string | null;
  details?: string | null;
  allergies?: string | null;
  conditions?: string | null;
}

export interface ProviderGenerationInput {
  patient: InterviewPatientContext;
  phase: InterviewPhase;
  answers: InterviewAnswerRecord[];
  askedCount: number;
  maxQuestions: number;
  batchSize: number;
  emergencyAcknowledged: boolean;
  pendingCandidates: InterviewQuestion[];
  sessionGoal: string;
  targetQuestionCount: number | null;
  providerState: InterviewProviderState | null;
}

export const SAFETY_GATE_PUBLIC_ID = 'safety_immediate_danger';
