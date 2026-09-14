// backend/src/modules/jobs/jobs.module.ts

import { Module } from '@nestjs/common';

import { AlertsModule } from '../alerts/alerts.module';
import { AssetsModule } from '../assets/assets.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsProcessor } from './processors/alerts.processor';
import { EventsProcessor } from './processors/events.processor';
import { LoggingProcessor } from './processors/logging.processor';
import { JobsService } from './jobs.service';
import { AssetsProcessor } from './processors/assets.processor';
import { JobQueueModule } from './job-queue.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WebhooksProcessor } from './processors/webhooks.processor';

@Module({
  imports: [
    JobQueueModule,
    PrismaModule,
    EventsModule,
    AlertsModule,
    AssetsModule,
    WebhooksModule,
  ],
  providers: [JobsService, EventsProcessor, AlertsProcessor, LoggingProcessor, AssetsProcessor, WebhooksProcessor],
})
export class JobsModule {}
