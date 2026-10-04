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
    @InjectQueue('logging') private readonly loggingQueue: Queue,
    @InjectQueue('assets') private readonly assetsQueue: Queue,
    @InjectQueue('webhooks') private readonly webhooksQueue: Queue,
    @InjectQueue('appointments') private readonly appointmentsQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    private readonly loggingService: LoggingService,
  ) {
    this.logger.log('JobsService initialized');
  }

  async onModuleInit() {
    this.logger.log('Setting up recurring jobs...');

    try {
      // Set up event polling job
      await this.notificationsQueue.add('deliver-notifications', {}, { repeat: { every: 15_000 }, removeOnComplete: 100, removeOnFail: 100 });
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

      // Full server-owned alert rule recovery sweep. Immediate encounter
      // changes are also queued from durable encounter events.
      await this.alertsQueue.add(
        'sweep-alert-rules',
        {},
        {
          repeat: { every: 60000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      this.loggingService.info(
        'Alert rule sweep configured',
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

      await this.loggingQueue.add(
        'purge-old-logs',
        {},
        {
          repeat: { every: 24 * 60 * 60 * 1000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      await this.assetsQueue.add(
        'reconcile-deletes',
        {},
        {
          repeat: { every: 5 * 60 * 1000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );

      await this.webhooksQueue.add(
        'deliver-webhooks',
        {},
        {
          repeat: { every: 15000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );

      await this.appointmentsQueue.add(
        'expire-clinic-requests',
        {},
        {
          repeat: { every: 60_000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );

      this.loggingService.info(
        'Log retention cleanup job configured',
        {
          service: 'JobsService',
          operation: 'onModuleInit',
          correlationId: undefined,
        },
        {
          interval: '86400000ms',
          queue: 'logging',
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
      await this.loggingService.error(
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
      await this.loggingService.error(
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
