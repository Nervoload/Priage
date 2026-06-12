// backend/src/modules/analytics/dto/hospital-analytics-response.dto.ts
// Lightweight analytics response DTOs.

import { EncounterStatus } from '@prisma/client';
import type { AnalyticsRange } from './get-hospital-analytics.query.dto';

export interface HospitalAnalyticsEncounterRowDto {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  status: EncounterStatus;
  chiefComplaint: string | null;
  currentCtasLevel: number | null;
  currentPriorityScore: number | null;
  arrivedAt: Date | null;
  triagedAt: Date | null;
  waitingAt: Date | null;
  seenAt: Date | null;
  departedAt: Date | null;
  cancelledAt: Date | null;
  triageAssessmentCount: number;
  messageCount: number;
  patientMessageCount: number;
  firstPatientMessageAt: Date | null;
  lastPatientMessageAt: Date | null;
}

export interface HospitalAnalyticsResponseDto {
  hospitalId: number;
  range: AnalyticsRange;
  since: Date | null;
  generatedAt: Date;
  total: number;
  data: HospitalAnalyticsEncounterRowDto[];
}
