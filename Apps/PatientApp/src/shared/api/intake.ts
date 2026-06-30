import { API_BASE_URL, client } from './client';
import {
  advanceDemoInterview,
  confirmDemoIntent,
  createDemoIntent,
  isStaticDemoMode,
  startDemoInterview,
  trackDemoEvent,
  updateDemoIntakeDetails,
} from '../../../../DemoShared/src/staticDemo';
import type {
  AdvanceInterviewPayload,
  InterviewState,
  ConfirmIntentPayload,
  CreateIntentPayload,
  CreateIntentResponse,
  Encounter,
  LocationPingPayload,
  UpdateIntakeDetailsPayload,
  UpdateIntakeDetailsResponse,
} from '../types/domain';
import { sendDurablePatientCommand } from '../patientCommandOutbox';

export async function createIntent(
  payload: CreateIntentPayload,
): Promise<CreateIntentResponse> {
  if (isStaticDemoMode()) {
    return createDemoIntent(payload) as Promise<CreateIntentResponse>;
  }
  const res = await fetch(`${API_BASE_URL}/intake/intent`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Could not start check-in' }));
    throw new Error(body.message ?? 'Could not start check-in');
  }

  return res.json();
}

export async function updateIntakeDetails(
  payload: UpdateIntakeDetailsPayload,
): Promise<Encounter | UpdateIntakeDetailsResponse> {
  if (isStaticDemoMode()) {
    return updateDemoIntakeDetails(payload) as Promise<Encounter | UpdateIntakeDetailsResponse>;
  }
  return sendDurablePatientCommand<Encounter | UpdateIntakeDetailsResponse>('/intake/details', 'PATCH', payload);
}

export async function confirmIntent(payload: ConfirmIntentPayload): Promise<Encounter> {
  if (isStaticDemoMode()) {
    return confirmDemoIntent(payload) as Promise<Encounter>;
  }
  return sendDurablePatientCommand<Encounter>('/intake/confirm', 'POST', payload);
}

export async function startInterview(): Promise<InterviewState> {
  if (isStaticDemoMode()) {
    return startDemoInterview() as Promise<InterviewState>;
  }
  return client<InterviewState>('/intake/interview/start', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function advanceInterview(payload: AdvanceInterviewPayload): Promise<InterviewState> {
  if (isStaticDemoMode()) {
    return advanceDemoInterview(payload) as Promise<InterviewState>;
  }
  return sendDurablePatientCommand<InterviewState>('/intake/interview/advance', 'POST', payload);
}

export async function sendLocationPing(payload: LocationPingPayload): Promise<{ ok: boolean }> {
  if (isStaticDemoMode()) {
    trackDemoEvent('patient_location_ping', { hasLatitude: Number.isFinite(payload.latitude), hasLongitude: Number.isFinite(payload.longitude) });
    return { ok: true };
  }
  return client<{ ok: boolean }>('/intake/location', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
