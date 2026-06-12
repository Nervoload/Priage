import { HttpStatus, Injectable } from '@nestjs/common';
import { AssetStatus } from '@prisma/client';
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
    const [pendingEvents, claimedEvents, deadLetterEvents, oldestPending, pendingAssetDeletes] = await Promise.all([
      this.prisma.encounterEvent.count({ where: { hospitalId, processedAt: null, deadLetteredAt: null } }),
      this.prisma.encounterEvent.count({ where: { hospitalId, processedAt: null, claimedAt: { not: null } } }),
      this.prisma.encounterEvent.count({ where: { hospitalId, deadLetteredAt: { not: null } } }),
      this.prisma.encounterEvent.findFirst({
        where: { hospitalId, processedAt: null, deadLetteredAt: null },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.asset.count({ where: { hospitalId, status: AssetStatus.DELETE_PENDING } }),
    ]);

    return {
      checkedAt: new Date(now).toISOString(),
      hospitalId,
      events: {
        pending: pendingEvents,
        claimed: claimedEvents,
        deadLetters: deadLetterEvents,
        oldestPendingAgeSeconds: oldestPending
          ? Math.max(0, Math.floor((now - oldestPending.createdAt.getTime()) / 1000))
          : 0,
      },
      assets: {
        pendingDeletes: pendingAssetDeletes,
      },
    };
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
