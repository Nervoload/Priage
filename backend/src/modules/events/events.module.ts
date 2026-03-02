// backend/src/modules/events/events.module.ts
// Provides helpers for creating encounter events and dispatching them to WebSockets.

import { Module, forwardRef } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';
import { EventsService } from './events.service';

@Module({
  providers: [EventsService],
  imports: [forwardRef(() => RealtimeModule)],
  exports: [EventsService],
})
export class EventsModule {}
