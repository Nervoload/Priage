import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../redis/redis.module';
import { LogEntry } from './types/log-entry.type';

type BufferStats = {
  enabled: boolean;
  backend: 'redis';
  ttlMs: number;
  lockTtlMs: number;
  promotedTtlMs: number;
};

@Injectable()
export class CorrelationLogBufferService {
  private readonly enabled = this.parseBooleanEnv(process.env.LOG_BUFFER_ENABLED, true);
  private readonly ttlMs = this.parseNumberEnv(process.env.LOG_BUFFER_TTL_MS, 10 * 60 * 1000);
  private readonly lockTtlMs = this.parseNumberEnv(process.env.LOG_BUFFER_LOCK_TTL_MS, 15_000);
  private readonly promotedTtlMs = this.parseNumberEnv(
    process.env.LOG_BUFFER_PROMOTED_TTL_MS,
    24 * 60 * 60 * 1000,
  );
  private readonly keyPrefix = process.env.LOG_BUFFER_KEY_PREFIX ?? 'logging:correlation';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  isEnabled(): boolean {
    return this.enabled;
  }

  async append(entry: LogEntry): Promise<void> {
    const correlationId = entry.context.correlationId;
    if (!this.enabled || !correlationId) {
      return;
    }

    const entriesKey = this.getEntriesKey(correlationId);
    await this.redis.rpush(entriesKey, JSON.stringify(entry));
    await this.redis.pexpire(entriesKey, this.ttlMs);
  }

  async promote(correlationId: string): Promise<void> {
    if (!this.enabled || !correlationId) {
      return;
    }

    await this.redis.set(this.getPromotedKey(correlationId), '1', 'PX', this.promotedTtlMs);
  }

  async touchPromotion(correlationId: string): Promise<void> {
    if (!this.enabled || !correlationId) {
      return;
    }

    await this.redis.pexpire(this.getPromotedKey(correlationId), this.promotedTtlMs);
  }

  async isPromoted(correlationId: string): Promise<boolean> {
    if (!this.enabled || !correlationId) {
      return false;
    }

    const exists = await this.redis.exists(this.getPromotedKey(correlationId));
    return exists === 1;
  }

  async hasProcessingEntries(correlationId: string): Promise<boolean> {
    if (!this.enabled || !correlationId) {
      return false;
    }

    const exists = await this.redis.exists(this.getProcessingKey(correlationId));
    return exists === 1;
  }

  async flush(
    correlationId: string,
    persistEntries: (entries: LogEntry[]) => Promise<void>,
  ): Promise<void> {
    if (!this.enabled || !correlationId) {
      return;
    }

    const token = this.generateLockToken();
    const lockKey = this.getLockKey(correlationId);
    const acquired = await this.redis.set(lockKey, token, 'PX', this.lockTtlMs, 'NX');
    if (acquired !== 'OK') {
      return;
    }

    const processingKey = this.getProcessingKey(correlationId);

    try {
      while (true) {
        const processingEntries = await this.readEntries(processingKey);
        if (processingEntries.length > 0) {
          await persistEntries(processingEntries);
          await this.redis.del(processingKey);
          continue;
        }

        const processingExists = await this.redis.exists(processingKey);
        if (processingExists === 1) {
          await this.redis.del(processingKey);
        }

        const moved = await this.moveEntriesToProcessing(correlationId);
        if (!moved) {
          break;
        }
      }
    } finally {
      await this.releaseLock(lockKey, token);
    }
  }

  getStats(): BufferStats {
    return {
      enabled: this.enabled,
      backend: 'redis',
      ttlMs: this.ttlMs,
      lockTtlMs: this.lockTtlMs,
      promotedTtlMs: this.promotedTtlMs,
    };
  }

  private async readEntries(key: string): Promise<LogEntry[]> {
    const values = await this.redis.lrange(key, 0, -1);
    const entries: LogEntry[] = [];

    for (const value of values) {
      try {
        const parsed = JSON.parse(value) as LogEntry & { timestamp: string };
        entries.push({
          ...parsed,
          timestamp: new Date(parsed.timestamp),
        });
      } catch {
        // Drop malformed entries rather than breaking the flush path.
      }
    }

    return entries;
  }

  private async moveEntriesToProcessing(correlationId: string): Promise<boolean> {
    const entriesKey = this.getEntriesKey(correlationId);
    const processingKey = this.getProcessingKey(correlationId);

    const result = await this.redis.eval(
      `
        if redis.call('EXISTS', KEYS[2]) == 1 then
          return 1
        end
        if redis.call('EXISTS', KEYS[1]) == 0 then
          return 0
        end
        redis.call('RENAME', KEYS[1], KEYS[2])
        redis.call('PEXPIRE', KEYS[2], ARGV[1])
        return 1
      `,
      2,
      entriesKey,
      processingKey,
      this.ttlMs.toString(),
    );

    return Number(result) === 1;
  }

  private async releaseLock(lockKey: string, token: string): Promise<void> {
    await this.redis.eval(
      `
        if redis.call('GET', KEYS[1]) == ARGV[1] then
          return redis.call('DEL', KEYS[1])
        end
        return 0
      `,
      1,
      lockKey,
      token,
    );
  }

  private getEntriesKey(correlationId: string): string {
    return `${this.keyPrefix}:${correlationId}:entries`;
  }

  private getProcessingKey(correlationId: string): string {
    return `${this.keyPrefix}:${correlationId}:processing`;
  }

  private getPromotedKey(correlationId: string): string {
    return `${this.keyPrefix}:${correlationId}:promoted`;
  }

  private getLockKey(correlationId: string): string {
    return `${this.keyPrefix}:${correlationId}:flush-lock`;
  }

  private generateLockToken(): string {
    return `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  }

  private parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) {
      return defaultValue;
    }

    return value.toLowerCase() !== 'false';
  }

  private parseNumberEnv(value: string | undefined, defaultValue: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
  }
}
