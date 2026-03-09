// backend/src/modules/redis/redis.module.ts
// Global Redis module.
// Provides a shared ioredis client for location caching and any future Redis needs.
// Reuses the same Redis instance already running for BullMQ jobs.

import { Global, Inject, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
class RedisLifecycleService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisLifecycleService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Redis client disconnected');
    } catch (error) {
      this.logger.warn('Redis client quit failed; forcing disconnect');
      this.client.disconnect();
      if (error instanceof Error) {
        this.logger.debug(error.message);
      }
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async () => {
        const logger = new Logger('RedisModule');
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = parseInt(process.env.REDIS_PORT ?? '6379', 10);

        const client = new Redis({
          host: redisHost,
          port: redisPort,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });

        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err) => logger.error('Redis error', err.message));

        try {
          await client.connect();
          await client.ping();
          logger.log(`Redis ready at ${redisHost}:${redisPort}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to connect to Redis at ${redisHost}:${redisPort}`, message);
          client.disconnect();
          throw error;
        }

        return client;
      },
    },
    RedisLifecycleService,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
