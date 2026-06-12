export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const DEMO_ACCESS_REQUIRED_EVENT = 'demo-access-required';
export const PATIENT_SESSION_EXPIRED_EVENT = 'patient-session-expired';

/**
 * Authenticated fetch wrapper for patient endpoints.
 * Browser auth is carried by an HttpOnly patient-session cookie.
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

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent(PATIENT_SESSION_EXPIRED_EVENT));
    } else if (response.status === 403 && body.includes('Demo access required')) {
      window.dispatchEvent(new CustomEvent(DEMO_ACCESS_REQUIRED_EVENT));
    }
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
