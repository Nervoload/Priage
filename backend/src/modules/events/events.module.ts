// backend/src/modules/events/events.module.ts
// Provides helpers for creating encounter events and dispatching them to WebSockets.

import { Module, forwardRef } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';
import { EventsService } from './events.service';
import { RedisModule } from '../redis/redis.module';
import { PatientRealtimeService } from './patient-realtime.service';
import { EventsAdminController } from './events-admin.controller';

@Module({
  controllers: [EventsAdminController],
  providers: [EventsService, PatientRealtimeService],
  imports: [forwardRef(() => RealtimeModule), RedisModule],
  exports: [EventsService, PatientRealtimeService],
})
export class EventsModule {}
