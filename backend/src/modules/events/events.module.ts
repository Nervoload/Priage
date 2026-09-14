// backend/src/modules/events/events.module.ts
// Provides helpers for creating encounter events and dispatching them to WebSockets.

import { Module, forwardRef } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';
import { EventsService } from './events.service';
import { RedisModule } from '../redis/redis.module';
import { PatientRealtimeService } from './patient-realtime.service';
import { EventsAdminController } from './events-admin.controller';
import { JobQueueModule } from '../jobs/job-queue.module';
import { AlertEvaluationScheduler } from './alert-evaluation.scheduler';

@Module({
  controllers: [EventsAdminController],
  providers: [EventsService, PatientRealtimeService, AlertEvaluationScheduler],
  imports: [forwardRef(() => RealtimeModule), RedisModule, JobQueueModule],
  exports: [EventsService, PatientRealtimeService],
})
export class EventsModule {}
