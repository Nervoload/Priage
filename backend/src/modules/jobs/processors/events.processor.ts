// backend/src/modules/jobs/processors/events.processor.ts
// BullMQ processor for encounter events.

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { EventsService } from '../../events/events.service';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('events')
export class EventsProcessor extends WorkerHost {
  private readonly logger = new Logger(EventsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {
    super();
    this.logger.log('EventsProcessor initialized');
  }

  async process(job: Job<any, any, string>): Promise<void> {
    const startTime = Date.now();
    
    this.logger.debug({
      message: 'Processing job',
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
    });

    try {
      switch (job.name) {
        case 'poll-events':
          await this.handlePoll();
          break;
        case 'dispatch-event':
          await this.handleDispatch(job as Job<{ eventId: number }>);
          break;
        default:
          this.logger.error({
            message: 'Unknown job name',
            jobId: job.id,
            jobName: job.name,
          });
          throw new Error(`Unknown job name: ${job.name}`);
      }

      const duration = Date.now() - startTime;
      // Only log completion in debug mode to reduce noise
      this.logger.debug({
        message: 'Job completed successfully',
        jobId: job.id,
        jobName: job.name,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        message: 'Job processing failed',
        jobId: job.id,
        jobName: job.name,
        attemptsMade: job.attemptsMade,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private async handlePoll(): Promise<void> {
    this.logger.debug('Polling for unprocessed events');

    try {
      const events = await this.prisma.encounterEvent.findMany({
        where: { processedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      if (events.length === 0) {
        // Silently return when no events - reduces log noise
        // Set LOG_LEVEL=debug to see these messages
        this.logger.debug('No unprocessed events found');
        return;
      }

      this.logger.log({
        message: 'Found unprocessed events',
        count: events.length,
        oldestEventId: events[0]?.id,
        newestEventId: events[events.length - 1]?.id,
      });

      let successCount = 0;
      let failureCount = 0;

      for (const event of events) {
        try {
          this.events.dispatchEncounterEvent(event);
          successCount++;
        } catch (error) {
          failureCount++;
          this.logger.error({
            message: 'Failed to dispatch event during poll',
            eventId: event.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await this.prisma.encounterEvent.updateMany({
        where: { id: { in: events.map((event) => event.id) } },
        data: { processedAt: new Date() },
      });

      this.logger.log({
        message: 'Event poll completed',
        totalEvents: events.length,
        successCount,
        failureCount,
      });
    } catch (error) {
      this.logger.error({
        message: 'Event polling failed',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private async handleDispatch(job: Job<{ eventId: number }>): Promise<void> {
    const { eventId } = job.data;
    
    this.logger.debug({
      message: 'Dispatching specific event',
      eventId,
    });

    try {
      const event = await this.prisma.encounterEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        this.logger.warn({
          message: 'Event not found for dispatch',
          eventId,
        });
        return;
      }

      if (event.processedAt) {
        this.logger.debug({
          message: 'Event already processed, skipping',
          eventId,
          processedAt: event.processedAt,
        });
        return;
      }

      this.events.dispatchEncounterEvent(event);

      await this.prisma.encounterEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });

      this.logger.log({
        message: 'Event dispatched and marked as processed',
        eventId,
      });
    } catch (error) {
      this.logger.error({
        message: 'Event dispatch failed',
        eventId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
