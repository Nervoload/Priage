// backend/src/modules/events/events.module.ts
// Provides helpers for emitting encounter events.

import { Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';
import { EventsService } from './events.service';

@Module({
  providers: [EventsService],
  imports: [RealtimeModule],
  exports: [EventsService],
})
export class EventsModule {}
