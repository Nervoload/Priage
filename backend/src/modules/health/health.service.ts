import { HttpStatus, Injectable } from '@nestjs/common';
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
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
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

  async getReadiness(): Promise<{ payload: ReadinessPayload; statusCode: number }> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const ok = database.ok && redis.ok;
    const payload: ReadinessPayload = {
      ok,
      status: ok ? 'ready' : 'degraded',
      checkedAt: new Date().toISOString(),
      dependencies: {
        database,
        redis,
      },
    };

    return {
      payload,
      statusCode: ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
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
        detail: error instanceof Error ? error.message : String(error),
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
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
