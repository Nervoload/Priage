// backend/src/modules/encounters/dto/encounter-response.dto.ts
// Response DTOs for encounter data.
// These define the shape of data returned to clients — staff vs patient views.

import { EncounterStatus } from '@prisma/client';

// ─── Patient summary included in encounter responses ────────────────────────

export interface EncounterPatientSummary {
  id: number;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  gender: string | null;
  preferredLanguage: string;
}

// ─── Staff-facing encounter list item ────────────────────────────────────────

export interface EncounterSummaryDto {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  status: EncounterStatus;
  chiefComplaint: string | null;
  hospitalId: number;
  patientId: number;
  currentCtasLevel: number | null;
  currentPriorityScore: number | null;

  // Pipeline timestamps
  expectedAt: Date | null;
  arrivedAt: Date | null;
  triagedAt: Date | null;
  waitingAt: Date | null;

  patient: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    age: number | null;
  };
}

// ─── Staff-facing encounter detail ───────────────────────────────────────────

export interface EncounterDetailDto extends EncounterSummaryDto {
  details: string | null;

  seenAt: Date | null;
  departedAt: Date | null;
  cancelledAt: Date | null;

  patient: EncounterPatientSummary & {
    heightCm: number | null;
    weightKg: number | null;
    allergies: string | null;
    conditions: string | null;
    optionalHealthInfo: unknown;
  };

  triageAssessments: Array<{
    id: number;
    createdAt: Date;
    ctasLevel: number;
    priorityScore: number;
    note: string | null;
    createdByUserId: number;
  }>;

  messages: Array<{
    id: number;
    createdAt: Date;
    senderType: string;
    content: string;
    isInternal: boolean;
    createdByUserId: number | null;
    createdByPatientId: number | null;
  }>;

  alerts: Array<{
    id: number;
    createdAt: Date;
    type: string;
    severity: string;
    acknowledgedAt: Date | null;
    resolvedAt: Date | null;
  }>;
}

// ─── Staff-facing encounter list response ────────────────────────────────────

export interface EncounterListResponseDto {
  data: EncounterSummaryDto[];
  total: number;
}

// ─── Patient-facing encounter view (limited) ─────────────────────────────────

export interface PatientEncounterDto {
  id: number;
  createdAt: Date;
  status: EncounterStatus;
  chiefComplaint: string | null;
  details: string | null;
  hospitalId: number;

  // Pipeline timestamps visible to patient
  expectedAt: Date | null;
  arrivedAt: Date | null;

  // Patient's own messages (non-internal only)
  messages: Array<{
    id: number;
    createdAt: Date;
    senderType: string;
    content: string;
    createdByUserId: number | null;
    createdByPatientId: number | null;
  }>;
}
