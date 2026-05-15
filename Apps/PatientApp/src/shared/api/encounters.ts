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

/** POST /patient/encounters/:id/cancel — cancel own encounter */
export async function cancelMyEncounter(id: number): Promise<Encounter> {
  return client<Encounter>(`/patient/encounters/${id}/cancel`, {
    method: 'POST',
  });
}

// ─── Messaging ──────────────────────────────────────────────────────────────

export interface ListMyMessagesParams {
  afterMessageId?: number;
  limit?: number;
}

/** GET /patient/encounters/:encounterId/messages */
export async function listMyMessages(
  encounterId: number,
  params: ListMyMessagesParams = {},
): Promise<Message[]> {
  const query = new URLSearchParams();

  if (params.afterMessageId != null) {
    query.set('afterMessageId', String(params.afterMessageId));
  }
  if (params.limit != null) {
    query.set('limit', String(params.limit));
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return client<Message[]>(`/patient/encounters/${encounterId}/messages${suffix}`);
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
