export type EncounterStatus =
  | 'EXPECTED'
  | 'ADMITTED'
  | 'TRIAGE'
  | 'WAITING'
  | 'COMPLETE'
  | 'UNRESOLVED'
  | 'CANCELLED';

export type SenderType = 'PATIENT' | 'USER' | 'SYSTEM';
export type HospitalIntakeResponseType = 'text' | 'textarea' | 'boolean' | 'number' | 'select';
export type HospitalIntakeAppliesTo = 'admit' | 'triage' | 'both';

export interface HospitalCustomIntakeQuestion {
  id: string;
  fieldKey: string;
  label: string;
  helpText: string;
  required: boolean;
  responseType: HospitalIntakeResponseType;
  appliesTo: HospitalIntakeAppliesTo;
}

export interface AssetSummary {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  url: string;
}

export interface PatientProfile {
  id: number;
  email: string;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  allergies: string | null;
  conditions: string | null;
  preferredLanguage: string;
  optionalHealthInfo?: Record<string, unknown> | null;
}

export interface AuthResponse {
  patient: PatientProfile;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  age?: number;
  gender?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  allergies?: string;
  conditions?: string;
  preferredLanguage?: string;
  currentPassword?: string;
}

export type PatientFeedbackType = 'feedback' | 'bug';

export interface SubmitPatientFeedbackPayload {
  type: PatientFeedbackType;
  message: string;
}

export interface DeletePatientAccountPayload {
  email: string;
  password: string;
}

export interface UpgradeGuestPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  age?: number;
  gender?: string;
  allergies?: string;
  conditions?: string;
}

export interface AuthenticatedPatientSession {
  patientId: number;
  patient: PatientProfile;
}

export interface GuestIntakeSession {
  patientId: number;
  encounterId: number | null;
  hospitalSlug: string | null;
  triageSessionId?: string;
  triageStatus?: TriageStatus;
  firstName?: string;
  lastName?: string;
  age?: number;
  gender?: string;
  chiefComplaint?: string;
  details?: string;
}

export interface EncounterMessage {
  id: number;
  createdAt: string;
  senderType: SenderType;
  content: string;
  createdByUserId?: number | null;
  createdByPatientId?: number | null;
  attachments: AssetSummary[];
}

export interface PriageSummaryQuestionAnswer {
  question: string;
  answer: string;
  phase: string;
  answeredAt: string;
}

export interface PriageSummary {
  briefing: string;
  recommendedCtasLevel: number | null;
  caseSummary: string;
  questionAnswers: PriageSummaryQuestionAnswer[];
  progressionRisks: string[];
  redFlags: string[];
  recommendedAction: string;
  generatedAt: string;
  generationMode: 'ai' | 'fallback';
}

export interface Encounter {
  id: number;
  createdAt: string;
  status: EncounterStatus;
  chiefComplaint: string | null;
  details: string | null;
  hospitalId: number;
  expectedAt: string | null;
  arrivedAt: string | null;
  messages: EncounterMessage[];
  intakeImages: AssetSummary[];
  priageSummary?: PriageSummary | null;
}

export interface EncounterSummary {
  id: number;
  createdAt: string;
  status: EncounterStatus;
  chiefComplaint: string | null;
  hospitalId: number;
  expectedAt: string | null;
  arrivedAt: string | null;
}

export interface QueueInfo {
  position: number;
  estimatedMinutes: number;
  totalInQueue: number;
}

export interface Message {
  id: number;
  createdAt: string;
  senderType: SenderType;
  content: string;
  createdByUserId?: number | null;
  createdByPatientId?: number | null;
  attachments?: AssetSummary[];
}

export interface ChatMessage {
  id: string;
  sender: 'patient' | 'staff' | 'system';
  text: string;
  timestamp: string;
}

export function messageToChatMessage(msg: Message): ChatMessage {
  return {
    id: String(msg.id),
    sender:
      msg.senderType === 'PATIENT'
        ? 'patient'
        : msg.senderType === 'SYSTEM'
          ? 'system'
          : 'staff',
    text: msg.content,
    timestamp: msg.createdAt,
  };
}

export interface CreateIntentPayload {
  firstName: string;
  lastName?: string;
  phone: string;
  age?: number;
  gender?: string;
  chiefComplaint: string;
  details?: string;
  preferredLanguage?: string;
}

export interface CreateIntentResponse {
  patientId: number;
  encounterId: number | null;
}

export interface UpdateIntakeDetailsPayload {
  chiefComplaint?: string;
  details?: string;
  firstName?: string;
  lastName?: string;
  age?: number;
  allergies?: string;
  conditions?: string;
  customQuestionAnswers?: Record<string, string | number | boolean | null | undefined>;
}

export interface UpdateIntakeDetailsResponse {
  ok: boolean;
  pending: boolean;
}

export interface ConfirmIntentPayload {
  hospitalId?: number;
  hospitalSlug?: string;
}

export type TriageStatus = 'ask_question' | 'complete' | 'urgent_review' | 'submitted';

export interface TriageMandatoryAnswers {
  onset: string;
  severity: number | 'unknown' | 'prefer_not_to_answer' | '';
  progression: 'better' | 'worse' | 'same' | 'unknown' | '';
  relevantHistory: string;
}

export interface TriageQuestion {
  id: string;
  text: string;
  inputType: 'text' | 'textarea' | 'number' | 'boolean' | 'single_select';
  options: string[];
  allowsOther: boolean;
  required: boolean;
  helpText: string;
}

export interface TriageAnswer {
  questionId: string;
  answer: string;
  question?: string;
  topic?: string;
}

export interface TriageSession {
  sessionId: string;
  status: TriageStatus;
  question: TriageQuestion | null;
  reasonForQuestion: string | null;
  summary: TriageSummary;
  chiefComplaint: string;
  urgentReview: boolean;
  urgencyReason: string | null;
  patientMessage: string | null;
  questionCount: number;
  maxQuestions: number;
  answers?: TriageAnswer[] | Record<string, string>;
  mandatoryAnswers?: TriageMandatoryAnswers;
}

export interface TriageSummary {
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
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  redFlags: string[];
  briefing: string;
  recommendedAction: string;
}

export interface StartTriagePayload {
  chiefComplaint: string;
  mandatoryAnswers: TriageMandatoryAnswers;
}

export interface AnswerTriagePayload {
  questionId: string;
  answer: string;
}

export interface LocationPingPayload {
  latitude: number;
  longitude: number;
}

export interface PriageChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PriageAssessment {
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  suggestedAction: string;
  summary: string;
}

export interface PriageChatResponse {
  reply: string;
  stage: string;
  assessment?: PriageAssessment;
  canAdmit: boolean;
}

export interface PriageAdmitPayload {
  chiefComplaint: string;
  details?: string;
  hospitalSlug?: string;
  severity?: number;
}

export interface PriageAdmitResponse {
  encounter: Encounter;
  message: string;
}

export interface Hospital {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  checkInInstructions: string | null;
  parkingNotes: string | null;
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  customIntakeQuestions: HospitalCustomIntakeQuestion[];
}

export type EncounterWorkspaceTab = 'current' | 'chat' | 'profile';
