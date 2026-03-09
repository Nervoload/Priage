// backend/src/modules/realtime/realtime.module.ts
// realtime.module.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Realtime module: provides WebSocket gateway for encounter events and messaging.

import { Module, forwardRef } from '@nestjs/common';

import { MessagingModule } from '../messaging/messaging.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RealtimeAuthService } from './realtime-auth.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeRedisAdapterService } from './realtime-redis-adapter.service';

@Module({
  providers: [RealtimeGateway, RealtimeAuthService, RealtimeRedisAdapterService],
  imports: [PrismaModule, RedisModule, forwardRef(() => MessagingModule)],
  exports: [RealtimeGateway, RealtimeAuthService, RealtimeRedisAdapterService],
})
export class RealtimeModule {}
