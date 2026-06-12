import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import { getAllowedCorsOrigins } from './cors.util';
import { PATIENT_SESSION_COOKIE, STAFF_AUTH_COOKIE, parseCookieHeader } from './auth-cookie.util';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PROTECTED_MUTATION_PREFIXES = [
  '/alerts',
  '/analytics',
  '/assets',
  '/encounters',
  '/hospitals',
  '/intake',
  '/logging',
  '/messaging',
  '/patient',
  '/patient-auth',
  '/patients',
  '/triage',
  '/users',
];

function isProductionRuntime(): boolean {
  return (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function requestPath(req: Record<string, any>): string {
  const raw = String(req.originalUrl || req.url || req.path || '/');
  try {
    return new URL(raw, 'http://localhost').pathname;
  } catch {
    return raw.split('?')[0] || '/';
  }
}

function requestOrigin(req: Record<string, any>): string | null {
  const host = req.get?.('host') ?? req.headers?.host;
  if (!host) {
    return null;
  }

  const forwardedProto = req.get?.('x-forwarded-proto') ?? req.headers?.['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || req.protocol || 'http';

  return normalizeOrigin(`${protocol}://${host}`);
}

function isProtectedMutation(req: Record<string, any>): boolean {
  if (SAFE_METHODS.has(String(req.method || '').toUpperCase())) {
    return false;
  }

  const path = requestPath(req);
  if (!PROTECTED_MUTATION_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return false;
  }

  // Partner API traffic is API-key based and may legitimately be server-to-server
  // without browser Origin/Referer headers.
  return !path.startsWith('/platform');
}

function hasSessionCookie(req: Record<string, any>): boolean {
  const cookies = parseCookieHeader(req.headers?.cookie);
  return Boolean(cookies[STAFF_AUTH_COOKIE] || cookies[PATIENT_SESSION_COOKIE]);
}

@Injectable()
export class OriginCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (!isProtectedMutation(req)) {
      return true;
    }

    const origin = normalizeOrigin(req.get?.('origin') ?? req.headers?.origin);
    const refererOrigin = normalizeOrigin(req.get?.('referer') ?? req.headers?.referer);
    const candidateOrigin = origin ?? refererOrigin;

    if (!candidateOrigin) {
      if (isProductionRuntime() || hasSessionCookie(req)) {
        throw new ForbiddenException('Origin or Referer header is required for browser write requests');
      }
      return true;
    }

    const allowed = new Set<string>([
      ...getAllowedCorsOrigins(),
      ...(process.env.CSRF_TRUSTED_ORIGINS ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ]);

    const selfOrigin = requestOrigin(req);
    if (selfOrigin) {
      allowed.add(selfOrigin);
    }

    if (!allowed.has(candidateOrigin)) {
      throw new ForbiddenException('Request origin is not allowed for browser write requests');
    }

    return true;
  }
}
