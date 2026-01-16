// backend/src/modules/jobs/jobs.service.ts
// Registers recurring jobs for event processing and alert evaluation.

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @InjectQueue('events') private readonly eventsQueue: Queue,
    @InjectQueue('alerts') private readonly alertsQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.eventsQueue.add(
      'poll-events',
      {},
      {
        repeat: { every: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    await this.alertsQueue.add(
      'triage-reassessment',
      {},
      {
        repeat: { every: 60000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async enqueueEventProcessing(eventId: number) {
    await this.eventsQueue.add('dispatch-event', { eventId });
  }
}
