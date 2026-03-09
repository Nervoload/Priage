// Priage AI API calls.

import { client } from './client';
import type {
  PriageChatMessage,
  PriageChatResponse,
  PriageAdmitPayload,
  PriageAdmitResponse,
  Hospital,
} from '../types/domain';

/** POST /patient/priage/chat — send conversation to AI, get response */
export async function priageChat(
  messages: PriageChatMessage[],
): Promise<PriageChatResponse> {
  return client<PriageChatResponse>('/patient/priage/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}

/** POST /patient/priage/admit — create encounter from AI assessment */
export async function priageAdmit(
  payload: PriageAdmitPayload,
): Promise<PriageAdmitResponse> {
  return client<PriageAdmitResponse>('/patient/priage/admit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** GET /patient/priage/hospitals — list available hospitals */
export async function listHospitals(): Promise<Hospital[]> {
  return client<Hospital[]>('/patient/priage/hospitals');
}
