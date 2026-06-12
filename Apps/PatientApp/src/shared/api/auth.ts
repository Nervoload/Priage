// Patient auth API calls.
// POST /patient-auth/register, /login, /upgrade, GET /me, PATCH /profile, DELETE /logout

import { client, API_BASE_URL } from './client';
import type {
  AuthResponse,
  DeletePatientAccountPayload,
  RegisterPayload,
  LoginPayload,
  SubmitPatientFeedbackPayload,
  UpdateProfilePayload,
  UpgradeGuestPayload,
  PatientProfile,
} from '../types/domain';
import { sendDurablePatientCommand } from '../patientCommandOutbox';

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(', ');
    }
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    // Fall back to the raw response body when it is not JSON.
  }

  return text;
}

async function requestAuth<T>(endpoint: string, fallback: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...((options.headers as Record<string, string>) ?? {}) },
    ...options,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, fallback));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/**
 * Register a new patient account (public — no token needed).
 */
export async function registerPatient(payload: RegisterPayload): Promise<AuthResponse> {
  return requestAuth<AuthResponse>('/patient-auth/register', 'Registration failed', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Login with email + password (public — no token needed).
 */
export async function loginPatient(payload: LoginPayload): Promise<AuthResponse> {
  return requestAuth<AuthResponse>('/patient-auth/login', 'Invalid credentials', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Get current patient profile.
 */
export async function getMe(): Promise<PatientProfile> {
  return client<PatientProfile>('/patient-auth/me');
}

/**
 * Update patient profile fields.
 */
export async function updateProfile(payload: UpdateProfilePayload): Promise<PatientProfile> {
  return sendDurablePatientCommand<PatientProfile>('/patient-auth/profile', 'PATCH', payload);
}

export async function submitPatientFeedback(payload: SubmitPatientFeedbackPayload): Promise<void> {
  await requestAuth('/patient-auth/feedback', 'Could not submit feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deletePatientAccount(payload: DeletePatientAccountPayload): Promise<void> {
  await requestAuth('/patient-auth/account', 'Could not delete account', {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

/**
 * Logout — destroy current session.
 */
export async function logout(): Promise<void> {
  await client('/patient-auth/logout', { method: 'DELETE' }).catch(() => {});
}

/**
 * Upgrade a guest intake session to a full account.
 * Uses the current cookie-backed patient session for auth.
 */
export async function upgradeGuestAccount(payload: UpgradeGuestPayload): Promise<AuthResponse> {
  return client<AuthResponse>('/patient-auth/upgrade', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
