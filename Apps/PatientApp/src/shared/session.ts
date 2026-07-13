import type {
  AuthenticatedPatientSession,
  GuestIntakeSession,
  TriageMandatoryAnswers,
  TriageStatus,
} from './types/domain';

export const AUTH_SESSION_KEY = 'patientAuthSession';
export const GUEST_SESSION_KEY = 'patientGuestSession';
const TRIAGE_DRAFT_PREFIX = 'patientTriageDraft';

// Draft persistence supports refresh/resume. Production policy must define
// consent, device-sharing warnings, expiry, and local-data clearing requirements.
export interface PatientTriageDraft {
  chiefComplaint: string;
  mandatoryAnswers: TriageMandatoryAnswers;
  sessionId?: string;
  status?: TriageStatus;
  currentAnswer?: string;
}

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

export function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

export function clearGuestSessionStorage() {
  localStorage.removeItem(GUEST_SESSION_KEY);
}

export function loadTriageDraft(scope: 'guest' | 'authenticated'): PatientTriageDraft | null {
  return loadJson<PatientTriageDraft>(`${TRIAGE_DRAFT_PREFIX}:${scope}`);
}

export function saveTriageDraft(
  scope: 'guest' | 'authenticated',
  draft: PatientTriageDraft | null,
) {
  saveJson(`${TRIAGE_DRAFT_PREFIX}:${scope}`, draft);
}

export function clearTriageDraft(scope: 'guest' | 'authenticated') {
  localStorage.removeItem(`${TRIAGE_DRAFT_PREFIX}:${scope}`);
}

export function clearAllPatientSessions() {
  clearAuthSession();
  clearGuestSessionStorage();
  clearTriageDraft('guest');
  clearTriageDraft('authenticated');
}
