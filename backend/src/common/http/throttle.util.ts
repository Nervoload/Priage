import { ExecutionContext } from '@nestjs/common';

type NamedThrottle = {
  default: {
    limit: number;
    ttl: number;
  };
};

function isProductionRuntime(): boolean {
  return (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  switch (raw.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true;
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false;
    default:
      return fallback;
  }
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes(',')) {
    return normalizeAddress(trimmed.split(',')[0]);
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function isLoopbackAddress(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '127.0.0.1' ||
    normalized === '::ffff:127.0.0.1' ||
    normalized.startsWith('127.')
  );
}

function extractRequestAddresses(req: Record<string, any>): string[] {
  const candidates = [
    req.ip,
    ...(Array.isArray(req.ips) ? req.ips : []),
    req.socket?.remoteAddress,
    req.connection?.remoteAddress,
    req.headers?.['x-forwarded-for'],
  ];

  return candidates
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => normalizeAddress(value))
    .filter((value): value is string => Boolean(value));
}

export function shouldSkipThrottleForLoopback(context: ExecutionContext): boolean {
  if (isProductionRuntime()) {
    return false;
  }

  if (!readBooleanEnv('THROTTLE_SKIP_LOOPBACK', true)) {
    return false;
  }

  const request = context.switchToHttp().getRequest();
  return extractRequestAddresses(request).some((address) => isLoopbackAddress(address));
}

function buildThrottle(limitEnv: string, ttlEnv: string, limitFallback: number, ttlFallback: number): NamedThrottle {
  return {
    default: {
      limit: readNumberEnv(limitEnv, limitFallback),
      ttl: readNumberEnv(ttlEnv, ttlFallback),
    },
  };
}

export const GLOBAL_THROTTLE = {
  limit: readNumberEnv('THROTTLE_GLOBAL_LIMIT', isProductionRuntime() ? 120 : 600),
  ttl: readNumberEnv('THROTTLE_GLOBAL_TTL_MS', 60_000),
};

export const STAFF_LOGIN_THROTTLE = buildThrottle(
  'THROTTLE_STAFF_LOGIN_LIMIT',
  'THROTTLE_STAFF_LOGIN_TTL_MS',
  isProductionRuntime() ? 10 : 30,
  60_000,
);

export const PATIENT_LOGIN_THROTTLE = buildThrottle(
  'THROTTLE_PATIENT_LOGIN_LIMIT',
  'THROTTLE_PATIENT_LOGIN_TTL_MS',
  isProductionRuntime() ? 5 : 20,
  60_000,
);

export const PATIENT_REGISTER_THROTTLE = buildThrottle(
  'THROTTLE_PATIENT_REGISTER_LIMIT',
  'THROTTLE_PATIENT_REGISTER_TTL_MS',
  isProductionRuntime() ? 3 : 12,
  15 * 60_000,
);

export const INTAKE_INTENT_THROTTLE = buildThrottle(
  'THROTTLE_INTAKE_INTENT_LIMIT',
  'THROTTLE_INTAKE_INTENT_TTL_MS',
  isProductionRuntime() ? 12 : 120,
  15 * 60_000,
);

export const DEMO_ACCESS_THROTTLE = buildThrottle(
  'THROTTLE_DEMO_ACCESS_LIMIT',
  'THROTTLE_DEMO_ACCESS_TTL_MS',
  isProductionRuntime() ? 5 : 30,
  15 * 60_000,
);
