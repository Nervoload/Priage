// HospitalApp/src/shared/api/client.ts
// John Surette
// Dec 8, 2025
// client.ts

// Small wrapper around fetch with base URL + auth header.
// Points at the local NestJS backend by default.

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
export const AUTH_EXPIRED_EVENT = 'auth-expired';
export const DEMO_ACCESS_REQUIRED_EVENT = 'demo-access-required';

export function notifyAuthExpired(): void {
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

export function isDemoAccessRequiredResponse(status: number, body: string): boolean {
  return status === 403 && body.includes('Demo access required');
}

export function notifyDemoAccessRequired(): void {
  window.dispatchEvent(new CustomEvent(DEMO_ACCESS_REQUIRED_EVENT));
}

/**
 * Authenticated fetch wrapper.
 * Browser auth is carried by HttpOnly cookies; no token is stored in JS.
 * Returns parsed JSON on success; throws on non-2xx responses.
 */
export async function client<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  // 401 → token expired or invalid → clear it and notify AuthContext
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 401) {
      notifyAuthExpired();
    }
    if (isDemoAccessRequiredResponse(response.status, body)) {
      notifyDemoAccessRequired();
    }
    throw new ApiError(response.status, body, endpoint);
  }

  // 204 No Content → return undefined
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/** Strongly-typed API error for callers to inspect */
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
