// PatientApp/src/shared/types/domain.ts
// Patient-side domain types — mirrors backend Prisma models relevant to patients.

// ─── Enums ──────────────────────────────────────────────────────────────────

export type EncounterStatus =
  | 'EXPECTED'
  | 'ADMITTED'
  | 'TRIAGE'
  | 'WAITING'
  | 'COMPLETE'
  | 'UNRESOLVED'
  | 'CANCELLED';

export type SenderType = 'PATIENT' | 'USER' | 'SYSTEM';

// ─── Patient profile ────────────────────────────────────────────────────────

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

// ─── Auth ───────────────────────────────────────────────────────────────────

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

// ─── Encounter ──────────────────────────────────────────────────────────────

export interface Encounter {
  id: number;
  createdAt: string;
  status: EncounterStatus;
  chiefComplaint: string | null;
  details: string | null;
  hospitalId: number;
  patientId: number;
  expectedAt: string | null;
  arrivedAt: string | null;
  triagedAt: string | null;
  waitingAt: string | null;
  departedAt: string | null;
  cancelledAt: string | null;
  patient?: PatientProfile;
  messages?: Message[];
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

// ─── Queue info ─────────────────────────────────────────────────────────────

export interface QueueInfo {
  position: number;
  estimatedMinutes: number;
  totalInQueue: number;
}

// ─── Messaging ──────────────────────────────────────────────────────────────

export interface Message {
  id: number;
  createdAt: string;
  senderType: SenderType;
  content: string;
  createdByPatientId?: number | null;
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

// ─── Priage AI ──────────────────────────────────────────────────────────────

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

// ─── Session (persisted in localStorage) ────────────────────────────────────

export interface PatientSession {
  sessionToken: string;
  patientId: number;
  patient: PatientProfile;
}
