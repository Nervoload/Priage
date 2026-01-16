// backend/src/modules/jobs/processors/events.processor.ts
// BullMQ processor for encounter events.

import { Process, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { EventsService } from '../../events/events.service';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('events')
export class EventsProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  @Process('poll-events')
  async handlePoll(): Promise<void> {
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

  @Process('dispatch-event')
  async handleDispatch(job: Job<{ eventId: number }>): Promise<void> {
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
