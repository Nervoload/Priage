// backend/src/modules/jobs/jobs.service.ts
// Registers recurring jobs for event processing and alert evaluation.

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { LoggingService } from '../logging/logging.service';

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('events') private readonly eventsQueue: Queue,
    @InjectQueue('alerts') private readonly alertsQueue: Queue,
    private readonly loggingService: LoggingService,
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

      this.loggingService.info(
        'Event polling job configured',
        {
          service: 'JobsService',
          operation: 'onModuleInit',
          correlationId: undefined,
        },
        {
          interval: '5000ms',
          queue: 'events',
        },
      );

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

      this.loggingService.info(
        'Triage reassessment job configured',
        {
          service: 'JobsService',
          operation: 'onModuleInit',
          correlationId: undefined,
        },
        {
          interval: '60000ms',
          queue: 'alerts',
        },
      );

      this.loggingService.info(
        'All recurring jobs configured successfully',
        {
          service: 'JobsService',
          operation: 'onModuleInit',
          correlationId: undefined,
        },
      );
    } catch (error) {
      this.loggingService.error(
        'Failed to configure recurring jobs',
        {
          service: 'JobsService',
          operation: 'onModuleInit',
          correlationId: undefined,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async enqueueEventProcessing(eventId: number) {
    this.loggingService.info(
      'Enqueuing event for processing',
      {
        service: 'JobsService',
        operation: 'enqueueEventProcessing',
        correlationId: undefined,
      },
      {
        eventId,
      },
    );

    try {
      await this.eventsQueue.add('dispatch-event', { eventId });
      
      this.loggingService.info(
        'Event enqueued successfully',
        {
          service: 'JobsService',
          operation: 'enqueueEventProcessing',
          correlationId: undefined,
        },
        {
          eventId,
        },
      );
    } catch (error) {
      this.loggingService.error(
        'Failed to enqueue event processing',
        {
          service: 'JobsService',
          operation: 'enqueueEventProcessing',
          correlationId: undefined,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          eventId,
        },
      );
      throw error;
    }
  }
}
