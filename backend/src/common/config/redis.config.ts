import type { RedisOptions } from 'ioredis';

export function getRedisConnectionOptions(overrides: RedisOptions = {}): RedisOptions {
  const tlsEnabled = isTrue(process.env.REDIS_TLS);
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
    username: process.env.REDIS_USERNAME?.trim() || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number.parseInt(process.env.REDIS_DB || '0', 10),
    tls: tlsEnabled
      ? {
          rejectUnauthorized: !isFalse(process.env.REDIS_TLS_REJECT_UNAUTHORIZED),
          servername: process.env.REDIS_TLS_SERVERNAME?.trim() || process.env.REDIS_HOST || undefined,
        }
      : undefined,
    ...overrides,
  };
}

function isTrue(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value || '').trim().toLowerCase());
}

function isFalse(value: string | undefined): boolean {
  return ['0', 'false', 'no', 'off'].includes((value || '').trim().toLowerCase());
}
