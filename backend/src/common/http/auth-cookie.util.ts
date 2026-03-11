import type { CookieOptions } from 'express';

export const STAFF_AUTH_COOKIE = 'priage_staff_auth';
export const PATIENT_SESSION_COOKIE = 'priage_patient_session';

const DEFAULT_STAFF_AUTH_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_PATIENT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function parsePositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveSameSite(): 'lax' | 'strict' | 'none' {
  const raw = process.env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase();
  if (raw === 'strict' || raw === 'none') {
    return raw;
  }
  return 'lax';
}

function shouldUseSecureCookies(sameSite: 'lax' | 'strict' | 'none'): boolean {
  return process.env.NODE_ENV === 'production' || sameSite === 'none';
}

export const STAFF_AUTH_TTL_MS = parsePositiveIntegerEnv(
  'STAFF_AUTH_TTL_MS',
  DEFAULT_STAFF_AUTH_TTL_MS,
);

export const PATIENT_SESSION_TTL_MS = parsePositiveIntegerEnv(
  'PATIENT_SESSION_TTL_MS',
  DEFAULT_PATIENT_SESSION_TTL_MS,
);

export function buildAuthCookieOptions(maxAgeMs: number): CookieOptions {
  const sameSite = resolveSameSite();

  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(sameSite),
    sameSite,
    path: '/',
    domain: process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
    maxAge: maxAgeMs,
  };
}

export function buildClearedAuthCookieOptions(): CookieOptions {
  const sameSite = resolveSameSite();

  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(sameSite),
    sameSite,
    path: '/',
    domain: process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined,
  };
}

export function parseCookieHeader(cookieHeader?: string | string[]): Record<string, string> {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;
  if (!header) {
    return {};
  }

  return header.split(';').reduce<Record<string, string>>((acc, chunk) => {
    const trimmed = chunk.trim();
    if (!trimmed) {
      return acc;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      return acc;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      return acc;
    }

    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

export function readCookie(cookieHeader: string | string[] | undefined, name: string): string | null {
  const cookies = parseCookieHeader(cookieHeader);
  return cookies[name] || null;
}
