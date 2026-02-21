// PatientApp/src/shared/api/client.ts
// Fetch wrapper for the patient app.
// Uses x-patient-token header instead of JWT Bearer token.

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const SESSION_KEY = 'patientSession';

/** Get the stored session token (if any). */
export function getSessionToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session.sessionToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Authenticated fetch wrapper for patient endpoints.
 * Attaches `x-patient-token` header from localStorage session.
 */
export async function client<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const token = getSessionToken();
  if (token) {
    headers['x-patient-token'] = token;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    window.dispatchEvent(new CustomEvent('patient-session-expired'));
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ApiError(response.status, body, endpoint);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/** Strongly-typed API error */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly endpoint: string,
  ) {
    super(`API ${endpoint} failed with ${status}: ${body}`);
    this.name = 'ApiError';
  }
}
