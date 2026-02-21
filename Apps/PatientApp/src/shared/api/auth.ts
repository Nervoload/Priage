// Patient auth API calls.
// POST /patient-auth/register, /login, GET /me, PATCH /profile, DELETE /logout

import { client, API_BASE_URL } from './client';
import type {
  AuthResponse,
  RegisterPayload,
  LoginPayload,
  UpdateProfilePayload,
  PatientProfile,
} from '../types/domain';

/**
 * Register a new patient account (public — no token needed).
 */
export async function registerPatient(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/patient-auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Registration failed' }));
    throw new Error(body.message ?? 'Registration failed');
  }

  return res.json();
}

/**
 * Login with email + password (public — no token needed).
 */
export async function loginPatient(payload: LoginPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/patient-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Invalid credentials' }));
    throw new Error(body.message ?? 'Invalid credentials');
  }

  return res.json();
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
  return client<PatientProfile>('/patient-auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Logout — destroy current session.
 */
export async function logout(): Promise<void> {
  await client('/patient-auth/logout', { method: 'DELETE' }).catch(() => {});
}
