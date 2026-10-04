import { describe, expect, it } from 'vitest';
import { OriginCsrfGuard } from '../src/common/http/origin-csrf.guard';
import { APPOINTMENT_RECOVERY_COOKIE, PATIENT_SESSION_COOKIE } from '../src/common/http/auth-cookie.util';

function context(path: string, origin?: string, cookieName = PATIENT_SESSION_COOKIE) {
  const headers = { host: 'localhost:3001', cookie: `${cookieName}=local-session`, ...(origin ? { origin } : {}) };
  const request = { method: 'POST', originalUrl: path, headers, protocol: 'http', get: (name: string) => headers[name.toLowerCase() as keyof typeof headers] };
  return { switchToHttp: () => ({ getRequest: () => request }) } as never;
}

describe('clinic write origin protection', () => {
  const guard = new OriginCsrfGuard();

  it('rejects missing and foreign origins on clinic mutations with a patient session', () => {
    expect(() => guard.canActivate(context('/clinic-intake/visits/12/appointment-request'))).toThrow('Origin or Referer');
    expect(() => guard.canActivate(context('/clinic-intake/visits/12/appointment-request', 'https://other.example'))).toThrow('not allowed');
  });

  it('protects recovery writes with the independent cookie', () => {
    expect(() => guard.canActivate(context('/clinic-intake/recovery/cancel', 'https://other.example', APPOINTMENT_RECOVERY_COOKIE))).toThrow('not allowed');
    expect(guard.canActivate(context('/clinic-intake/recovery/cancel', 'http://localhost:3001', APPOINTMENT_RECOVERY_COOKIE))).toBe(true);
  });

  it('accepts same-origin clinic mutations and read requests', () => {
    expect(guard.canActivate(context('/clinic-intake/visits/12/appointment-request', 'http://localhost:3001'))).toBe(true);
    const read = { switchToHttp: () => ({ getRequest: () => ({ method: 'GET', originalUrl: '/clinic-intake/visits/12/state' }) }) } as never;
    expect(guard.canActivate(read)).toBe(true);
  });
});
