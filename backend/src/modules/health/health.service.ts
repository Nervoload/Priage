import { HttpStatus, Injectable } from '@nestjs/common';
import { AssetStatus, LogRecordLevel } from '@prisma/client';
import type Redis from 'ioredis';

import { Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

type DependencyStatus = {
  ok: boolean;
  latencyMs?: number;
  detail?: string;
};

type ReadinessPayload = {
  ok: boolean;
  status: 'ready' | 'degraded';
  checkedAt: string;
};

type DetailedReadinessPayload = ReadinessPayload & {
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
    eventBacklog: DependencyStatus;
  };
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  getLiveness() {
    return {
      ok: true,
      status: 'live' as const,
      checkedAt: new Date().toISOString(),
    };
  }

  async getReadiness(includeDetails = false): Promise<{ payload: ReadinessPayload | DetailedReadinessPayload; statusCode: number }> {
    const [database, redis, eventBacklog] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkEventBacklog(),
    ]);

    const ok = database.ok && redis.ok && eventBacklog.ok;
    const payload: ReadinessPayload = {
      ok,
      status: ok ? 'ready' : 'degraded',
      checkedAt: new Date().toISOString(),
    };

    return {
      payload: includeDetails
        ? {
            ...payload,
            dependencies: {
              database,
              redis,
              eventBacklog,
            },
          }
        : payload,
      statusCode: ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    };
  }

  async getOperationalMetrics(hospitalId: number) {
    const now = Date.now();
    const recentWindow = new Date(now - 15 * 60 * 1000);
    const [
      pendingEvents,
      claimedEvents,
      deadLetterEvents,
      oldestPending,
      pendingAssetDeletes,
      recentErrors,
      recentWarnings,
      sensitiveReads,
      breakGlassReads,
      pool,
    ] = await Promise.all([
      this.prisma.encounterEvent.count({ where: { hospitalId, processedAt: null, deadLetteredAt: null } }),
      this.prisma.encounterEvent.count({ where: { hospitalId, processedAt: null, claimedAt: { not: null } } }),
      this.prisma.encounterEvent.count({ where: { hospitalId, deadLetteredAt: { not: null } } }),
      this.prisma.encounterEvent.findFirst({
        where: { hospitalId, processedAt: null, deadLetteredAt: null },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.asset.count({ where: { hospitalId, status: AssetStatus.DELETE_PENDING } }),
      this.prisma.logRecord.count({ where: { hospitalId, level: LogRecordLevel.ERROR, createdAt: { gte: recentWindow } } }),
      this.prisma.logRecord.count({ where: { hospitalId, level: LogRecordLevel.WARN, createdAt: { gte: recentWindow } } }),
      this.prisma.sensitiveReadAuditLog.count({ where: { hospitalId, createdAt: { gte: recentWindow } } }),
      this.prisma.breakGlassAccess.count({ where: { hospitalId, createdAt: { gte: recentWindow } } }),
      this.prisma.getPoolStats(),
    ]);
    const oldestPendingAgeSeconds = oldestPending
      ? Math.max(0, Math.floor((now - oldestPending.createdAt.getTime()) / 1000))
      : 0;
    const thresholds = {
      eventLagWarningSeconds: readPositiveIntegerEnv('SLO_EVENT_LAG_WARN_SECONDS', 30),
      eventLagCriticalSeconds: readPositiveIntegerEnv('SLO_EVENT_LAG_CRITICAL_SECONDS', 120),
      errorLogWarningCount: readPositiveIntegerEnv('SLO_ERROR_LOG_WARN_COUNT', 10),
      poolWaitingWarningCount: readPositiveIntegerEnv('SLO_POOL_WAITING_WARN_COUNT', 1),
    };
    const alerts = [
      ...(deadLetterEvents > 0 ? [{ severity: 'critical', type: 'event_dead_letter', value: deadLetterEvents }] : []),
      ...(oldestPendingAgeSeconds >= thresholds.eventLagCriticalSeconds
        ? [{ severity: 'critical', type: 'event_lag', value: oldestPendingAgeSeconds }]
        : oldestPendingAgeSeconds >= thresholds.eventLagWarningSeconds
          ? [{ severity: 'warning', type: 'event_lag', value: oldestPendingAgeSeconds }]
          : []),
      ...(recentErrors >= thresholds.errorLogWarningCount
        ? [{ severity: 'warning', type: 'recent_errors', value: recentErrors }]
        : []),
      ...(pool.waitingCount >= thresholds.poolWaitingWarningCount
        ? [{ severity: 'warning', type: 'database_pool_waiting', value: pool.waitingCount }]
        : []),
      ...(breakGlassReads > 0
        ? [{ severity: 'security', type: 'break_glass_access', value: breakGlassReads }]
        : []),
    ];

    return {
      checkedAt: new Date(now).toISOString(),
      hospitalId,
      events: {
        pending: pendingEvents,
        claimed: claimedEvents,
        deadLetters: deadLetterEvents,
        oldestPendingAgeSeconds,
      },
      assets: {
        pendingDeletes: pendingAssetDeletes,
      },
      database: {
        pool,
      },
      logs: {
        windowMinutes: 15,
        errors: recentErrors,
        warnings: recentWarnings,
      },
      security: {
        windowMinutes: 15,
        sensitiveReads,
        breakGlassReads,
      },
      slo: {
        state: alerts.some((alert) => alert.severity === 'critical') ? 'critical'
          : alerts.length > 0 ? 'warning' : 'healthy',
        thresholds,
        alerts,
      },
    };
  }

  async getPrometheusMetrics(): Promise<string> {
    const [pool, pendingEvents, deadLetters, pendingAssetDeletes] = await Promise.all([
      this.prisma.getPoolStats(),
      this.prisma.encounterEvent.count({ where: { processedAt: null, deadLetteredAt: null } }),
      this.prisma.encounterEvent.count({ where: { deadLetteredAt: { not: null } } }),
      this.prisma.asset.count({ where: { status: AssetStatus.DELETE_PENDING } }),
    ]);

    return [
      '# HELP priage_database_pool_connections Database connections by state.',
      '# TYPE priage_database_pool_connections gauge',
      `priage_database_pool_connections{state="total"} ${pool.totalCount}`,
      `priage_database_pool_connections{state="idle"} ${pool.idleCount}`,
      `priage_database_pool_connections{state="waiting"} ${pool.waitingCount}`,
      '# HELP priage_event_backlog Pending and dead-letter encounter events.',
      '# TYPE priage_event_backlog gauge',
      `priage_event_backlog{state="pending"} ${pendingEvents}`,
      `priage_event_backlog{state="dead_letter"} ${deadLetters}`,
      '# HELP priage_asset_deletion_backlog Assets waiting for storage deletion reconciliation.',
      '# TYPE priage_asset_deletion_backlog gauge',
      `priage_asset_deletion_backlog ${pendingAssetDeletes}`,
      '',
    ].join('\n');
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        detail: 'database unavailable',
      };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    const startedAt = Date.now();

    try {
      const pong = await this.redis.ping();

      return {
        ok: pong === 'PONG',
        latencyMs: Date.now() - startedAt,
        detail: pong === 'PONG' ? undefined : `Unexpected ping response: ${pong}`,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        detail: 'redis unavailable',
      };
    }
  }

  private async checkEventBacklog(): Promise<DependencyStatus> {
    const startedAt = Date.now();
    try {
      const [pending, deadLetters] = await Promise.all([
        this.prisma.encounterEvent.count({ where: { processedAt: null, deadLetteredAt: null } }),
        this.prisma.encounterEvent.count({ where: { deadLetteredAt: { not: null } } }),
      ]);
      const maxPending = Number.parseInt(process.env.EVENT_READINESS_MAX_PENDING || '5000', 10);
      const maxDeadLetters = Number.parseInt(process.env.EVENT_READINESS_MAX_DEAD_LETTERS || '0', 10);
      const ok = pending <= maxPending && deadLetters <= maxDeadLetters;
      return {
        ok,
        latencyMs: Date.now() - startedAt,
        detail: `pending=${pending}, deadLetters=${deadLetters}`,
      };
    } catch {
      return { ok: false, latencyMs: Date.now() - startedAt, detail: 'event backlog unavailable' };
    }
  }
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
