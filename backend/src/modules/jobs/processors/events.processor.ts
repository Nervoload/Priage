// backend/src/modules/jobs/processors/events.processor.ts
// BullMQ processor for encounter events.

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { EventsService } from '../../events/events.service';
import { LoggingService } from '../../logging/logging.service';
import { PrismaService } from '../../prisma/prisma.service';

const IMMEDIATE_DISPATCH_GRACE_MS = 10_000;

@Processor('events')
export class EventsProcessor extends WorkerHost {
  private readonly logger = new Logger(EventsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly loggingService: LoggingService,
  ) {
    super();
    this.logger.log('EventsProcessor initialized');
  }

  async process(job: Job<any, any, string>): Promise<void> {
    const startTime = Date.now();
    
    await this.loggingService.debug(
      'Processing events job',
      {
        service: 'EventsProcessor',
        operation: 'process',
        correlationId: undefined,
      },
      {
        jobId: job.id ? String(job.id) : undefined,
        jobName: job.name,
        attemptsMade: job.attemptsMade,
      },
    );

    try {
      switch (job.name) {
        case 'poll-events':
          await this.handlePoll();
          break;
        case 'dispatch-event':
          await this.handleDispatch(job as Job<{ eventId: number }>);
          break;
        default:
          await this.loggingService.error(
            'Unknown events job name',
            {
              service: 'EventsProcessor',
              operation: 'process',
              correlationId: undefined,
            },
            new Error(`Unknown job name: ${job.name}`),
            {
              jobId: job.id ? String(job.id) : undefined,
              jobName: job.name,
            },
          );
          throw new Error(`Unknown job name: ${job.name}`);
      }

      const duration = Date.now() - startTime;
      await this.loggingService.debug(
        'Events job completed successfully',
        {
          service: 'EventsProcessor',
          operation: 'process',
          correlationId: undefined,
        },
        {
          jobId: job.id ? String(job.id) : undefined,
          jobName: job.name,
          durationMs: duration,
        },
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.loggingService.error(
        'Events job processing failed',
        {
          service: 'EventsProcessor',
          operation: 'process',
          correlationId: undefined,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          jobId: job.id ? String(job.id) : undefined,
          jobName: job.name,
          attemptsMade: job.attemptsMade,
          durationMs: duration,
        },
      );
      throw error;
    }
  }

  private async handlePoll(): Promise<void> {
    await this.loggingService.debug(
      'Polling for unprocessed events',
      {
        service: 'EventsProcessor',
        operation: 'handlePoll',
        correlationId: undefined,
      },
    );

    try {
      const fallbackCutoff = new Date(Date.now() - IMMEDIATE_DISPATCH_GRACE_MS);
      const events = await this.prisma.encounterEvent.findMany({
        where: {
          processedAt: null,
          createdAt: { lt: fallbackCutoff },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      if (events.length === 0) {
        // Silently return when no events - reduces log noise
        // Set LOG_LEVEL=debug to see these messages
        await this.loggingService.debug(
          'No unprocessed events found',
          {
            service: 'EventsProcessor',
            operation: 'handlePoll',
            correlationId: undefined,
          },
        );
        return;
      }

      await this.loggingService.info(
        'Found unprocessed events',
        {
          service: 'EventsProcessor',
          operation: 'handlePoll',
          correlationId: undefined,
        },
        {
          count: events.length,
          oldestEventId: events[0]?.id,
          newestEventId: events[events.length - 1]?.id,
        },
      );

      let successCount = 0;
      let failureCount = 0;

      for (const event of events) {
        try {
          const dispatched = await this.events.dispatchEncounterEventAndMarkProcessed(event);
          if (dispatched) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
          await this.loggingService.error(
            'Failed to dispatch event during poll',
            {
              service: 'EventsProcessor',
              operation: 'handlePoll',
              correlationId: undefined,
              encounterId: event.encounterId,
              hospitalId: event.hospitalId,
            },
            error instanceof Error ? error : new Error(String(error)),
            {
              eventId: event.id,
            },
          );
        }
      }

      await this.loggingService.info(
        'Event poll completed',
        {
          service: 'EventsProcessor',
          operation: 'handlePoll',
          correlationId: undefined,
        },
        {
          totalEvents: events.length,
          successCount,
          failureCount,
        },
      );
    } catch (error) {
      await this.loggingService.error(
        'Event polling failed',
        {
          service: 'EventsProcessor',
          operation: 'handlePoll',
          correlationId: undefined,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private async handleDispatch(job: Job<{ eventId: number }>): Promise<void> {
    const { eventId } = job.data;
    
    await this.loggingService.debug(
      'Dispatching specific event',
      {
        service: 'EventsProcessor',
        operation: 'handleDispatch',
        correlationId: undefined,
      },
      {
        eventId,
      },
    );

    try {
      const dispatched = await this.events.dispatchEncounterEventById(eventId);
      if (!dispatched) {
        throw new Error(`Failed to dispatch event ${eventId}`);
      }

      await this.loggingService.info(
        'Event dispatched and marked as processed',
        {
          service: 'EventsProcessor',
          operation: 'handleDispatch',
          correlationId: undefined,
        },
        {
          eventId,
        },
      );
    } catch (error) {
      await this.loggingService.error(
        'Event dispatch failed',
        {
          service: 'EventsProcessor',
          operation: 'handleDispatch',
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
