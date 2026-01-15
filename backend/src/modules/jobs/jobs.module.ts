// backend/src/modules/jobs/jobs.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AlertsModule } from '../alerts/alerts.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsProcessor } from './processors/alerts.processor';
import { EventsProcessor } from './processors/events.processor';
import { JobsService } from './jobs.service';

const redisHost = process.env.REDIS_HOST ?? 'localhost';
const redisPort = Number(process.env.REDIS_PORT ?? '6379');

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: redisHost,
        port: redisPort,
      },
    }),
    BullModule.registerQueue({
      name: 'events',
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    }),
    BullModule.registerQueue({
      name: 'alerts',
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    }),
    PrismaModule,
    EventsModule,
    AlertsModule,
  ],
  providers: [JobsService, EventsProcessor, AlertsProcessor],
})
export class JobsModule {}
