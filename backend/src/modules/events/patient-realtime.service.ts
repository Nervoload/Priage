import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { EncounterEvent } from '@prisma/client';
import type Redis from 'ioredis';
import { Observable, Subject, filter } from 'rxjs';

import { REDIS_CLIENT } from '../redis/redis.module';

const CHANNEL = 'priage:patient-events';
const RESERVE_CONNECTION_SCRIPT = `
local now = tonumber(ARGV[1])
local staleBefore = now - tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', staleBefore)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]) * 2)
return 1
`;

@Injectable()
export class PatientRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly events$ = new Subject<EncounterEvent>();
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(@Inject(REDIS_CLIENT) redis: Redis) {
    this.publisher = redis.duplicate();
    this.subscriber = redis.duplicate();
  }

  async onModuleInit(): Promise<void> {
    await Promise.all([this.connect(this.publisher), this.connect(this.subscriber)]);
    await this.subscriber.subscribe(CHANNEL);
    this.subscriber.on('message', (_channel, payload) => {
      try {
        const parsed = JSON.parse(payload) as EncounterEvent & { createdAt: string; processedAt: string | null };
        this.events$.next({
          ...parsed,
          createdAt: new Date(parsed.createdAt),
          processedAt: parsed.processedAt ? new Date(parsed.processedAt) : null,
        });
      } catch {
        // Invalid broker payloads are ignored; durable event polling remains authoritative.
      }
    });
  }

  async publish(event: EncounterEvent): Promise<void> {
    await this.publisher.publish(CHANNEL, JSON.stringify(event));
  }

  observe(encounterId: number): Observable<EncounterEvent> {
    return this.events$.asObservable().pipe(filter((event) => event.encounterId === encounterId));
  }

  async reservePatientConnection(patientId: number, connectionId: string): Promise<boolean> {
    const staleMs = this.readPositiveIntEnv('PATIENT_SSE_CONNECTION_STALE_MS', 90_000);
    const limit = this.readPositiveIntEnv('PATIENT_SSE_CONNECTIONS_PER_PATIENT', 3);
    const result = await this.publisher.eval(
      RESERVE_CONNECTION_SCRIPT,
      1,
      this.connectionKey(patientId),
      Date.now(),
      staleMs,
      limit,
      connectionId,
    );
    return Number(result) === 1;
  }

  async touchPatientConnection(patientId: number, connectionId: string): Promise<void> {
    const staleMs = this.readPositiveIntEnv('PATIENT_SSE_CONNECTION_STALE_MS', 90_000);
    const key = this.connectionKey(patientId);
    await this.publisher.zadd(key, Date.now(), connectionId);
    await this.publisher.pexpire(key, staleMs * 2);
  }

  async releasePatientConnection(patientId: number, connectionId: string): Promise<void> {
    await this.publisher.zrem(this.connectionKey(patientId), connectionId);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
  }

  private async connect(client: Redis): Promise<void> {
    if (client.status === 'wait') await client.connect();
  }

  private connectionKey(patientId: number): string {
    return `patient-sse:${patientId}:connections`;
  }

  private readPositiveIntEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
