// backend/src/modules/events/events.module.ts
// Provides helpers for emitting encounter events.

import { Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';
import { EventsService } from './events.service';

// Phase 6.1: Register an SSE controller here (e.g. EventsSseController) to expose
// a GET /events/stream endpoint using @Sse() decorator. The controller would use
// Observable<MessageEvent> to push encounter events, alerts, and status changes
// to the frontend in real time — replacing the 30-second polling in useAlerts.ts.
@Module({
  providers: [EventsService],
  imports: [RealtimeModule],
  exports: [EventsService],
})
export class EventsModule {}
