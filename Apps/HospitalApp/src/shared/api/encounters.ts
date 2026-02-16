// HospitalApp/src/shared/api/encounters.ts
// API calls for encounters — mirrors backend EncountersController.
// Uses the authenticated fetch wrapper from client.ts.

import { client } from './client';
import type { Encounter, EncounterListResponse, EncounterStatus } from '../types/domain';

// ─── List encounters (with optional status filter) ─────────────────────────

export interface ListEncountersParams {
  status?: EncounterStatus[];
  since?: string;
  limit?: number;
}

export async function listEncounters(
  params: ListEncountersParams = {},
): Promise<EncounterListResponse> {
  const query = new URLSearchParams();
  if (params.status) {
    params.status.forEach(s => query.append('status', s));
  }
  if (params.since) query.set('since', params.since);
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return client<EncounterListResponse>(`/encounters${qs ? `?${qs}` : ''}`);
}

// ─── Get a single encounter (with relations) ───────────────────────────────

export async function getEncounter(id: number): Promise<Encounter> {
  return client<Encounter>(`/encounters/${id}`);
}

// ─── Create encounter ──────────────────────────────────────────────────────

export interface CreateEncounterPayload {
  patientId: number;
  chiefComplaint: string;
  details?: string;
}

export async function createEncounter(
  payload: CreateEncounterPayload,
): Promise<Encounter> {
  return client<Encounter>('/encounters', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Status transitions ────────────────────────────────────────────────────

export async function confirmEncounter(id: number): Promise<Encounter> {
  return client<Encounter>(`/encounters/${id}/confirm`, { method: 'POST' });
}

export async function markArrived(id: number): Promise<Encounter> {
  return client<Encounter>(`/encounters/${id}/arrived`, { method: 'POST' });
}

export async function startExam(id: number): Promise<Encounter> {
  return client<Encounter>(`/encounters/${id}/start-exam`, { method: 'POST' });
}

export async function moveToWaiting(id: number): Promise<Encounter> {
  return client<Encounter>(`/encounters/${id}/waiting`, { method: 'POST' });
}

export async function dischargeEncounter(id: number): Promise<Encounter> {
  return client<Encounter>(`/encounters/${id}/discharge`, { method: 'POST' });
}

export async function cancelEncounter(id: number): Promise<Encounter> {
  return client<Encounter>(`/encounters/${id}/cancel`, { method: 'POST' });
}
