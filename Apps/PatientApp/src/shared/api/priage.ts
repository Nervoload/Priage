// Priage AI API calls.

import { client } from './client';
import {
  demoPriageAdmit,
  demoPriageChat,
  isStaticDemoMode,
  listDemoHospitals,
} from '../../../../DemoShared/src/staticDemo';
import type {
  PriageChatMessage,
  PriageChatResponse,
  PriageAdmitPayload,
  PriageAdmitResponse,
  Hospital,
} from '../types/domain';
import { sendDurablePatientCommand } from '../patientCommandOutbox';

/** POST /patient/priage/chat — send conversation to AI, get response */
export async function priageChat(
  messages: PriageChatMessage[],
): Promise<PriageChatResponse> {
  if (isStaticDemoMode()) {
    return demoPriageChat(messages) as PriageChatResponse;
  }
  return client<PriageChatResponse>('/patient/priage/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}

/** POST /patient/priage/admit — create encounter from AI assessment */
export async function priageAdmit(
  payload: PriageAdmitPayload,
): Promise<PriageAdmitResponse> {
  if (isStaticDemoMode()) {
    return demoPriageAdmit(payload) as Promise<PriageAdmitResponse>;
  }
  return sendDurablePatientCommand<PriageAdmitResponse>('/patient/priage/admit', 'POST', payload);
}

/** GET /patient/priage/hospitals — list available hospitals */
export async function listHospitals(): Promise<Hospital[]> {
  if (isStaticDemoMode()) {
    return listDemoHospitals() as Hospital[];
  }
  return client<Hospital[]>('/patient/priage/hospitals');
}
