// HospitalApp/src/shared/types/domain.ts
// Shared domain types that mirror the NestJS backend Prisma schema.
// Keep in sync with backend/prisma/schema.prisma.

// ─── Enums (mirror Prisma enums) ────────────────────────────────────────────

export type EncounterStatus =
  | 'EXPECTED'
  | 'ADMITTED'
  | 'TRIAGE'
  | 'WAITING'
  | 'COMPLETE'
  | 'UNRESOLVED'
  | 'CANCELLED';

export type Role = 'ADMIN' | 'NURSE' | 'STAFF' | 'DOCTOR';

export type SenderType = 'PATIENT' | 'USER' | 'SYSTEM';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ─── Patient ────────────────────────────────────────────────────────────────

export interface PatientSummary {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  age: number | null;
  gender?: string | null;
  preferredLanguage?: string;
}

// ─── Patient helpers ────────────────────────────────────────────────────────

/** Build a display name from nullable first/last name fields. */
export function patientName(p: Pick<PatientSummary, 'firstName' | 'lastName'>): string {
  const parts = [p.firstName, p.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Unknown';
}

/** Return a human-readable age string (or fallback). */
export function getPatientAge(p: Pick<PatientSummary, 'age'>): string {
  return p.age != null ? `${p.age} yrs` : 'N/A';
}

/**
 * Shape a PatientSummary for sending to the API.
 * Strips undefined/optional UI-only fields and ensures required keys exist.
 */
export function formatPatientForApi(
  p: Pick<PatientSummary, 'firstName' | 'lastName' | 'phone' | 'age' | 'gender'>,
): {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  age: number | null;
  gender: string | null;
} {
  return {
    firstName: p.firstName ?? null,
    lastName: p.lastName ?? null,
    phone: p.phone ?? null,
    age: p.age ?? null,
    gender: p.gender ?? null,
  };
}

// ─── Encounter ──────────────────────────────────────────────────────────────

export interface Encounter {
  id: number;
  createdAt: string;
  updatedAt: string;
  status: EncounterStatus;
  chiefComplaint: string | null;
  details: string | null;
  hospitalId: number;
  patientId: number;

  currentCtasLevel: number | null;
  currentPriorityScore: number | null;

  // Pipeline timestamps
  expectedAt: string | null;
  arrivedAt: string | null;
  triagedAt: string | null;
  waitingAt: string | null;
  seenAt?: string | null;
  departedAt?: string | null;
  cancelledAt?: string | null;

  // Nested relations (included on detail fetches)
  patient: PatientSummary;
  triageAssessments?: TriageAssessment[];
  messages?: Message[];
  alerts?: Alert[];
}

export interface EncounterListResponse {
  data: Encounter[];
  total: number;
}

// ─── Triage ─────────────────────────────────────────────────────────────────

export interface VitalSigns {
  bloodPressure?: string;  // e.g. "120/80"
  heartRate?: number;
  temperature?: number;    // °C
  respiratoryRate?: number;
  oxygenSaturation?: number; // %
}

export interface TriageAssessment {
  id: number;
  createdAt: string;
  ctasLevel: number;
  priorityScore: number;
  chiefComplaint: string | null;
  painLevel: number | null;
  vitalSigns: VitalSigns | null;
  note: string | null;
  createdByUserId: number;
  encounterId: number;
  hospitalId: number;
}

export interface CreateTriagePayload {
  encounterId: number;
  ctasLevel: number;
  chiefComplaint?: string;
  painLevel?: number;
  vitalSigns?: VitalSigns;
  note?: string;
}

// ─── Message ────────────────────────────────────────────────────────────────

export interface Message {
  id: number;
  createdAt: string;
  senderType: SenderType;
  content: string;
  isInternal: boolean;
  createdByUserId: number | null;
  createdByPatientId: number | null;
  encounterId: number;
  hospitalId: number;
}

// ─── Alert ──────────────────────────────────────────────────────────────────

export interface Alert {
  id: number;
  createdAt: string;
  type: string;
  severity: AlertSeverity;
  metadata: Record<string, unknown> | null;

  acknowledgedAt: string | null;
  acknowledgedByUserId: number | null;
  resolvedAt: string | null;
  resolvedByUserId: number | null;

  encounterId: number;
  hospitalId: number;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    email: string;
    role: Role;
    hospitalId: number;
    hospital: {
      id: number;
      name: string;
      slug: string;
    };
  };
}

export interface AuthUser {
  userId: number;
  email: string;
  role: Role;
  hospitalId: number;
  hospital?: {
    id: number;
    name: string;
    slug: string;
  };
}

// ─── Chat (frontend-specific, maps to Message) ─────────────────────────────

export interface ChatMessage {
  id: string;
  encounterId: number;
  sender: 'admin' | 'patient';
  text: string;
  timestamp: string;
}

/** Convert a backend Message to the frontend ChatMessage shape */
export function messageToChatMessage(msg: Message): ChatMessage {
  return {
    id: String(msg.id),
    encounterId: msg.encounterId,
    sender: msg.senderType === 'PATIENT' ? 'patient' : 'admin',
    text: msg.content,
    timestamp: msg.createdAt,
  };
}

// ─── Realtime event names (mirror backend realtime.events.ts) ───────────────

export const RealtimeEvents = {
  EncounterUpdated: 'encounter.updated',
  MessageCreated: 'message.created',
  AlertCreated: 'alert.created',
  AlertAcknowledged: 'alert.acknowledged',
  AlertResolved: 'alert.resolved',
} as const;
