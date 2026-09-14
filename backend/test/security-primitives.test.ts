import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildPatientCookieHeader,
  generatePatientSessionToken,
  hashPatientCookie,
  hashPatientSessionToken,
} = require('../scripts/lib/session-cookies') as {
  buildPatientCookieHeader(token: string): string;
  generatePatientSessionToken(): string;
  hashPatientCookie(cookie: string): string | null;
  hashPatientSessionToken(token: string): string;
};

describe('patient session primitives', () => {
  it('creates opaque unique tokens and stores only deterministic hashes', () => {
    const first = generatePatientSessionToken();
    const second = generatePatientSessionToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(hashPatientSessionToken(first)).toHaveLength(64);
    expect(hashPatientSessionToken(first)).not.toBe(first);
    expect(hashPatientSessionToken(first)).toBe(hashPatientSessionToken(first));
  });

  it('decodes the cookie value before applying the server-side hash', () => {
    const token = generatePatientSessionToken();
    expect(hashPatientCookie(buildPatientCookieHeader(token))).toBe(hashPatientSessionToken(token));
    expect(hashPatientCookie('unrelated=value')).toBeNull();
  });
});
