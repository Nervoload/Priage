// backend/src/modules/jobs/processors/events.processor.ts
// BullMQ processor for encounter events.

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { EventsService } from '../../events/events.service';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('events')
export class EventsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<void> {
    switch (job.name) {
      case 'poll-events':
        return this.handlePoll();
      case 'dispatch-event':
        return this.handleDispatch(job as Job<{ eventId: number }>);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async handlePoll(): Promise<void> {
    const events = await this.prisma.encounterEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    if (events.length === 0) {
      return;
    }

    for (const event of events) {
      this.events.dispatchEncounterEvent(event);
    }

    await this.prisma.encounterEvent.updateMany({
      where: { id: { in: events.map((event) => event.id) } },
      data: { processedAt: new Date() },
    });
  }

  private async handleDispatch(job: Job<{ eventId: number }>): Promise<void> {
    const event = await this.prisma.encounterEvent.findUnique({
      where: { id: job.data.eventId },
    });

    if (!event || event.processedAt) {
      return;
    }

    this.events.dispatchEncounterEvent(event);

    await this.prisma.encounterEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
  }
}
