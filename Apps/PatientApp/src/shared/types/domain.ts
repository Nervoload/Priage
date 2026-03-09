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
  sessionToken: string;
  patientId: number;
  patient: PatientProfile;
}

export interface GuestIntakeSession {
  sessionToken: string;
  patientId: number;
  encounterId: number | null;
  hospitalSlug: string | null;
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
