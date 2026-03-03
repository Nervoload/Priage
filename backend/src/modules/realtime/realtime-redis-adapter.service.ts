import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import type { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

import { LoggingService } from '../logging/logging.service';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class RealtimeRedisAdapterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeRedisAdapterService.name);
  private pubClient?: Redis;
  private subClient?: Redis;
  private attached = false;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly loggingService: LoggingService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.pubClient = this.redis.duplicate();
    this.subClient = this.redis.duplicate();

    try {
      await Promise.all([
        this.connectClient(this.pubClient),
        this.connectClient(this.subClient),
      ]);
      this.logger.log('Socket.IO Redis adapter clients connected');
      await this.loggingService.info(
        'Socket.IO Redis adapter clients connected',
        {
          service: 'RealtimeRedisAdapterService',
          operation: 'onModuleInit',
          correlationId: undefined,
        },
      );
    } catch (error) {
      await this.onModuleDestroy();
      this.logger.error(
        'Failed to initialize Socket.IO Redis adapter clients',
        error instanceof Error ? error.stack : undefined,
      );
      await this.loggingService.error(
        'Failed to initialize Socket.IO Redis adapter clients',
        {
          service: 'RealtimeRedisAdapterService',
          operation: 'onModuleInit',
          correlationId: undefined,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async attach(server: Server): Promise<void> {
    if (!this.pubClient || !this.subClient) {
      await this.loggingService.error(
        'Socket.IO Redis adapter attach attempted before initialization',
        {
          service: 'RealtimeRedisAdapterService',
          operation: 'attach',
          correlationId: undefined,
        },
        new Error('Socket.IO Redis adapter clients are not initialized'),
      );
      throw new Error('Socket.IO Redis adapter clients are not initialized');
    }

    if (this.attached) {
      return;
    }

    server.adapter(createAdapter(this.pubClient as never, this.subClient as never));
    this.attached = true;
    this.logger.log('Socket.IO Redis adapter attached');
    await this.loggingService.info(
      'Socket.IO Redis adapter attached',
      {
        service: 'RealtimeRedisAdapterService',
        operation: 'attach',
        correlationId: undefined,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    const clients = [this.pubClient, this.subClient];
    this.pubClient = undefined;
    this.subClient = undefined;
    this.attached = false;

    await Promise.all(
      clients
        .filter((client): client is Redis => !!client)
        .map(async (client) => {
          try {
            await client.quit();
          } catch {
            client.disconnect();
          }
        }),
    );
  }

  private async connectClient(client: Redis): Promise<void> {
    if (client.status === 'ready' || client.status === 'connecting' || client.status === 'connect') {
      return;
    }

    await client.connect();
  }
}
