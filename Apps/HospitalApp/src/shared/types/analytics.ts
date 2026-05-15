// HospitalApp/src/shared/types/analytics.ts
// Lightweight analytics-specific encounter payloads.

import type { EncounterStatus } from './domain';

export const ANALYTICS_RANGES = ['day', 'week', 'month', 'year', 'all'] as const;
export type AnalyticsRange = typeof ANALYTICS_RANGES[number];

export interface AnalyticsEncounterRow {
  id: number;
  createdAt: string;
  updatedAt: string;
  status: EncounterStatus;
  chiefComplaint: string | null;
  currentCtasLevel: number | null;
  currentPriorityScore: number | null;
  arrivedAt: string | null;
  triagedAt: string | null;
  waitingAt: string | null;
  seenAt: string | null;
  departedAt: string | null;
  cancelledAt: string | null;
  triageAssessmentCount: number;
  messageCount: number;
  patientMessageCount: number;
  firstPatientMessageAt: string | null;
  lastPatientMessageAt: string | null;
}

export interface AnalyticsResponse {
  hospitalId: number;
  range: AnalyticsRange;
  since: string | null;
  generatedAt: string;
  total: number;
  data: AnalyticsEncounterRow[];
}
