import type { PoolConfig } from 'pg';

export type DatabaseProxyMode = 'direct' | 'pgbouncer' | 'rds-proxy';

export type DatabasePoolSettings = {
  proxyMode: DatabaseProxyMode;
  max: number;
  min: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxLifetimeSeconds: number;
  statementTimeoutMillis: number;
  queryTimeoutMillis: number;
  connectionAttempts: number;
};

export function getDatabasePoolSettings(): DatabasePoolSettings {
  return {
    proxyMode: readProxyMode(process.env.DATABASE_PROXY_MODE),
    max: readPositiveInteger('DATABASE_POOL_MAX', 20),
    min: readNonNegativeInteger('DATABASE_POOL_MIN', 0),
    idleTimeoutMillis: readPositiveInteger('DATABASE_POOL_IDLE_TIMEOUT_MS', 30_000),
    connectionTimeoutMillis: readPositiveInteger('DATABASE_POOL_CONNECTION_TIMEOUT_MS', 2_000),
    maxLifetimeSeconds: readPositiveInteger('DATABASE_POOL_MAX_LIFETIME_SECONDS', 300),
    statementTimeoutMillis: readPositiveInteger('DATABASE_POOL_STATEMENT_TIMEOUT_MS', 15_000),
    queryTimeoutMillis: readPositiveInteger('DATABASE_POOL_QUERY_TIMEOUT_MS', 20_000),
    connectionAttempts: readPositiveInteger('DATABASE_CONNECTION_ATTEMPTS', 3),
  };
}

export function buildDatabasePoolConfig(connectionString: string): PoolConfig {
  const settings = getDatabasePoolSettings();
  return {
    connectionString,
    max: settings.max,
    min: Math.min(settings.min, settings.max),
    idleTimeoutMillis: settings.idleTimeoutMillis,
    connectionTimeoutMillis: settings.connectionTimeoutMillis,
    maxLifetimeSeconds: settings.maxLifetimeSeconds,
    // Transaction-mode PgBouncer rejects session startup parameters because
    // a client does not retain one PostgreSQL session between transactions.
    ...(settings.proxyMode === 'pgbouncer'
      ? {}
      : { statement_timeout: settings.statementTimeoutMillis }),
    query_timeout: settings.queryTimeoutMillis,
    application_name: process.env.DATABASE_APPLICATION_NAME?.trim() || 'priage-backend',
  };
}

function readProxyMode(value: string | undefined): DatabaseProxyMode {
  const normalized = (value || 'direct').trim().toLowerCase();
  if (normalized === 'pgbouncer' || normalized === 'rds-proxy') {
    return normalized;
  }
  return 'direct';
}

function readPositiveInteger(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInteger(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
