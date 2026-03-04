// PatientApp/src/shared/api/encounters.ts
// Patient-facing API calls — encounters, messaging, queue.

import { client } from './client';
import type {
  Encounter,
  EncounterSummary,
  Message,
  QueueInfo,
} from '../types/domain';

// ─── Encounters ─────────────────────────────────────────────────────────────

/** GET /patient/encounters — list own encounters */
export async function listMyEncounters(): Promise<EncounterSummary[]> {
  return client<EncounterSummary[]>('/patient/encounters');
}

/** GET /patient/encounters/:id — get own encounter detail */
export async function getMyEncounter(id: number): Promise<Encounter> {
  return client<Encounter>(`/patient/encounters/${id}`);
}

/** GET /patient/encounters/:id/queue — estimated queue position */
export async function getQueueInfo(id: number): Promise<QueueInfo> {
  return client<QueueInfo>(`/patient/encounters/${id}/queue`);
}

// ─── Messaging ──────────────────────────────────────────────────────────────

/** GET /patient/encounters/:encounterId/messages */
export async function listMyMessages(encounterId: number): Promise<Message[]> {
  return client<Message[]>(`/patient/encounters/${encounterId}/messages`);
}

/** POST /patient/encounters/:encounterId/messages */
export async function sendPatientMessage(
  encounterId: number,
  content: string,
  isWorsening = false,
): Promise<Message> {
  return client<Message>(`/patient/encounters/${encounterId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, isWorsening }),
  });
}
