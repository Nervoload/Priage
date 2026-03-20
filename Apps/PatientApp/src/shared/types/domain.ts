export type EncounterStatus =
  | 'EXPECTED'
  | 'ADMITTED'
  | 'TRIAGE'
  | 'WAITING'
  | 'COMPLETE'
  | 'UNRESOLVED'
  | 'CANCELLED';

export type SenderType = 'PATIENT' | 'USER' | 'SYSTEM';

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
}

export interface AuthResponse {
  sessionToken: string;
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
  sessionToken: string;
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
}

export interface UpdateIntakeDetailsResponse {
  ok: boolean;
  pending: boolean;
}

export interface ConfirmIntentPayload {
  hospitalId?: number;
  hospitalSlug?: string;
}

export type InterviewPhase = 'urgent' | 'emergent' | 'history';
export type InterviewInputType = 'text' | 'textarea' | 'number' | 'boolean' | 'single_select';
export type InterviewStatus = 'in_progress' | 'emergency_ack_required' | 'complete';

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

export interface InterviewState {
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

export interface AdvanceInterviewPayload {
  questionPublicId?: string;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueChoice?: string;
  action?: 'acknowledge_emergency';
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
}

export type EncounterWorkspaceTab = 'current' | 'chat' | 'profile';
