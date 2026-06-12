// backend/src/modules/jobs/jobs.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AlertsModule } from '../alerts/alerts.module';
import { AssetsModule } from '../assets/assets.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsProcessor } from './processors/alerts.processor';
import { EventsProcessor } from './processors/events.processor';
import { LoggingProcessor } from './processors/logging.processor';
import { JobsService } from './jobs.service';
import { AssetsProcessor } from './processors/assets.processor';
import { getRedisConnectionOptions } from '../../common/config/redis.config';

@Module({
  imports: [
    BullModule.forRoot({
      connection: getRedisConnectionOptions({ maxRetriesPerRequest: null }),
    }),
    BullModule.registerQueue({
      name: 'events',
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    }),
    BullModule.registerQueue({
      name: 'alerts',
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    }),
    BullModule.registerQueue({
      name: 'logging',
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    }),
    BullModule.registerQueue({
      name: 'assets',
      defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 10000 } },
    }),
    PrismaModule,
    EventsModule,
    AlertsModule,
    AssetsModule,
  ],
  providers: [JobsService, EventsProcessor, AlertsProcessor, LoggingProcessor, AssetsProcessor],
})
export class JobsModule {}
