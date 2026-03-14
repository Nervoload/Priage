import { API_BASE_URL, client } from './client';
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

export async function createIntent(
  payload: CreateIntentPayload,
): Promise<CreateIntentResponse> {
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
  return client<Encounter | UpdateIntakeDetailsResponse>('/intake/details', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function confirmIntent(payload: ConfirmIntentPayload): Promise<Encounter> {
  return client<Encounter>('/intake/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function startInterview(): Promise<InterviewState> {
  return client<InterviewState>('/intake/interview/start', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function advanceInterview(payload: AdvanceInterviewPayload): Promise<InterviewState> {
  return client<InterviewState>('/intake/interview/advance', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function sendLocationPing(payload: LocationPingPayload): Promise<{ ok: boolean }> {
  return client<{ ok: boolean }>('/intake/location', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
