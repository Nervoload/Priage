import type { AuthenticatedPatientSession, GuestIntakeSession } from './types/domain';

export const AUTH_SESSION_KEY = 'patientAuthSession';
export const GUEST_SESSION_KEY = 'patientGuestSession';

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function saveJson<T>(key: string, value: T | null) {
  if (value) {
    localStorage.setItem(key, JSON.stringify(value));
  } else {
    localStorage.removeItem(key);
  }
}

export function loadAuthSession(): AuthenticatedPatientSession | null {
  return loadJson<AuthenticatedPatientSession>(AUTH_SESSION_KEY);
}

export function saveAuthSession(session: AuthenticatedPatientSession | null) {
  saveJson(AUTH_SESSION_KEY, session);
}

export function loadGuestSession(): GuestIntakeSession | null {
  return loadJson<GuestIntakeSession>(GUEST_SESSION_KEY);
}

export function saveGuestSession(session: GuestIntakeSession | null) {
  saveJson(GUEST_SESSION_KEY, session);
}

export function clearAllPatientSessions() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(GUEST_SESSION_KEY);
}

export function getStoredPatientToken(): string | null {
  return loadAuthSession()?.sessionToken ?? loadGuestSession()?.sessionToken ?? null;
}
