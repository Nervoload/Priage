export type InterviewPhase = 'urgent' | 'emergent' | 'history';
export type InterviewInputType = 'text' | 'textarea' | 'number' | 'boolean' | 'single_select';
export type InterviewStatus = 'in_progress' | 'emergency_ack_required' | 'complete';
export type InterviewUrgency = 'low' | 'medium' | 'high' | 'emergency';
export type InterviewGenerationMode = 'ai' | 'fallback';

export interface InterviewGovernance {
  version: string;
  generationMode: InterviewGenerationMode;
  decisionSupportOnly: true;
  humanReviewRequired: true;
  emergencyInstructions: string;
  provider: {
    name: 'openai' | 'deterministic' | 'none';
    model: string | null;
    promptVersion: string | null;
  };
  reviewState: 'UNREVIEWED';
}

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
  /** Why the warning was raised. Staff-facing only. */
  reason?: string;
  /** The answered question that triggered the warning. Staff-facing only. */
  triggerQuestionId?: string;
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

export interface InterviewQuestionAnswerRecord {
  question: string;
  answer: string;
  phase: InterviewPhase;
  answeredAt: string;
}

export interface InterviewSummaryRecord {
  urgency: InterviewUrgency;
  redFlags: string[];
  recommendedAction: string;
  summaryPreview: string;
  combinedDetails: string;
  briefing: string;
  recommendedCtasLevel: number | null;
  caseSummary: string;
  questionAnswers: InterviewQuestionAnswerRecord[];
  progressionRisks: string[];
}

export interface InterviewProviderState {
  providerName: 'openai' | 'deterministic';
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

/** A clinic's own questions, fixed for the life of one interview and asked right after the safety question. */
export interface ClinicQuestionnairePin {
  versionId: number;
  version: number;
  questions: InterviewQuestion[];
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
  governance: InterviewGovernance;
  /** Set only for clinic visits whose clinic has published questions. */
  clinicQuestionnaire: ClinicQuestionnairePin | null;
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
  generationMode: InterviewGenerationMode;
  governance: InterviewGovernance;
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
  recommendedCtasLevel: number | null;
  briefing: string;
  caseSummary: string;
  progressionRisks: string[];
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
