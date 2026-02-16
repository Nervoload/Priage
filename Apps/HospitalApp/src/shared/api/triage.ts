// HospitalApp/src/shared/api/triage.ts
// API calls for triage — mirrors backend TriageController.

import { client } from './client';
import type { TriageAssessment, CreateTriagePayload } from '../types/domain';

/**
 * POST /triage/assessments
 * Create a new triage assessment for an encounter.
 */
export async function createTriageAssessment(
  payload: CreateTriagePayload,
): Promise<TriageAssessment> {
  return client<TriageAssessment>('/triage/assessments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * GET /triage/assessments/:id
 * Get a single triage assessment by ID.
 */
export async function getTriageAssessment(
  id: number,
): Promise<TriageAssessment> {
  return client<TriageAssessment>(`/triage/assessments/${id}`);
}

/**
 * GET /triage/encounters/:encounterId/assessments
 * List all triage assessments for an encounter (chronological).
 */
export async function listTriageAssessments(
  encounterId: number,
): Promise<TriageAssessment[]> {
  return client<TriageAssessment[]>(
    `/triage/encounters/${encounterId}/assessments`,
  );
}
