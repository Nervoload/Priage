// backend/src/modules/jobs/jobs.service.ts
// Registers recurring jobs for event processing and alert evaluation.

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('events') private readonly eventsQueue: Queue,
    @InjectQueue('alerts') private readonly alertsQueue: Queue,
  ) {
    this.logger.log('JobsService initialized');
  }

  async onModuleInit() {
    this.logger.log('Setting up recurring jobs...');

    try {
      // Set up event polling job
      await this.eventsQueue.add(
        'poll-events',
        {},
        {
          repeat: { every: 5000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      this.logger.log({
        message: 'Event polling job configured',
        interval: '5000ms',
        queue: 'events',
      });

      // Set up triage reassessment job
      await this.alertsQueue.add(
        'triage-reassessment',
        {},
        {
          repeat: { every: 60000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      this.logger.log({
        message: 'Triage reassessment job configured',
        interval: '60000ms',
        queue: 'alerts',
      });

      this.logger.log('All recurring jobs configured successfully');
    } catch (error) {
      this.logger.error({
        message: 'Failed to configure recurring jobs',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async enqueueEventProcessing(eventId: number) {
    this.logger.log({
      message: 'Enqueuing event for processing',
      eventId,
    });

    try {
      await this.eventsQueue.add('dispatch-event', { eventId });
      
      this.logger.log({
        message: 'Event enqueued successfully',
        eventId,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to enqueue event processing',
        eventId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
