import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { getRedisConnectionOptions } from '../../common/config/redis.config';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: getRedisConnectionOptions({ maxRetriesPerRequest: null }),
    }),
    BullModule.registerQueue(
      { name: 'notifications', defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } } },
      {
        name: 'events',
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      },
      {
        name: 'alerts',
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      },
      {
        name: 'logging',
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      },
      {
        name: 'assets',
        defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 10000 } },
      },
      {
        name: 'webhooks',
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      },
      {
        name: 'appointments',
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      },
    ),
  ],
  exports: [BullModule],
})
export class JobQueueModule {}
