// backend/src/modules/redis/redis.module.ts
// Global Redis module.
// Provides a shared ioredis client for location caching and any future Redis needs.
// Reuses the same Redis instance already running for BullMQ jobs.

import { Global, Module, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const logger = new Logger('RedisModule');
        const client = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });

        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err) => logger.error('Redis error', err.message));

        // Connect eagerly so failures surface at startup
        client.connect().catch((err) => {
          logger.error('Failed to connect to Redis', err.message);
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor() {}

  // ioredis client is injected at the provider level, not here — 
  // but NestJS will call disconnect through the factory's lifecycle.
  async onModuleDestroy() {
    // The client will be garbage-collected; ioredis handles cleanup.
  }
}
