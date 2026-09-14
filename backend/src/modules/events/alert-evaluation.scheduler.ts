import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { EncounterEvent, EventType } from '@prisma/client';
import type { Queue } from 'bullmq';

const STATE_EVENTS = new Set<EventType>([
  EventType.ENCOUNTER_CREATED,
  EventType.STATUS_CHANGE,
  EventType.TRIAGE_CREATED,
  EventType.TRIAGE_COMPLETED,
]);

@Injectable()
export class AlertEvaluationScheduler {
  constructor(@InjectQueue('alerts') private readonly alertsQueue: Queue) {}

  async enqueueForEncounterEvent(event: EncounterEvent): Promise<void> {
    if (!STATE_EVENTS.has(event.type)) return;
    await this.alertsQueue.add(
      'evaluate-encounter',
      { encounterId: event.encounterId, hospitalId: event.hospitalId, sourceEventId: event.id },
      {
        jobId: `alert-evaluation-event-${event.id}`,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }
}
