// backend/src/modules/events/events.service.ts
// Domain event helpers for encounter-centric events.

import { Injectable, Logger } from '@nestjs/common';
import { EncounterEvent, EventType, Prisma } from '@prisma/client';

import { RealtimeGateway } from '../realtime/realtime.gateway';

export type EncounterEventActor = {
  actorUserId?: number;
  actorPatientId?: number;
};

export type EmitEncounterEventArgs = {
  encounterId: number;
  hospitalId?: number;
  type: EventType;
  metadata?: Prisma.InputJsonValue;
  actor?: EncounterEventActor;
};

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly realtime: RealtimeGateway) {}

  async emitEncounterEventTx(
    tx: Prisma.TransactionClient,
    args: EmitEncounterEventArgs,
  ): Promise<EncounterEvent | null> {
    if (!args.hospitalId) {
      this.logger.warn(
        `Skipping encounter event without hospitalId for encounter ${args.encounterId}`,
      );
      return null;
    }

    return tx.encounterEvent.create({
      data: {
        encounterId: args.encounterId,
        hospitalId: args.hospitalId,
        type: args.type,
        metadata: args.metadata,
        actorUserId: args.actor?.actorUserId,
        actorPatientId: args.actor?.actorPatientId,
      },
    });
  }

  dispatchEncounterEvent(event: EncounterEvent): void {
    const payloadBase = {
      eventId: event.id,
      encounterId: event.encounterId,
      hospitalId: event.hospitalId,
      createdAt: event.createdAt,
      metadata: event.metadata,
    };

    switch (event.type) {
      case EventType.ENCOUNTER_CREATED:
      case EventType.STATUS_CHANGE:
      case EventType.TRIAGE_CREATED:
      case EventType.TRIAGE_COMPLETED:
        this.realtime.emitEncounterUpdated(event.hospitalId, event.encounterId, payloadBase);
        break;
      case EventType.MESSAGE_CREATED:
        this.realtime.emitMessageCreated(event.hospitalId, event.encounterId, payloadBase);
        break;
      case EventType.ALERT_CREATED:
        this.realtime.emitAlertCreated(event.hospitalId, event.encounterId, payloadBase);
        break;
      case EventType.ALERT_ACKNOWLEDGED:
        this.realtime.emitAlertAcknowledged(event.hospitalId, event.encounterId, payloadBase);
        break;
      case EventType.ALERT_RESOLVED:
        this.realtime.emitAlertResolved(event.hospitalId, event.encounterId, payloadBase);
        break;
      default:
        this.logger.debug(`Unhandled event type for realtime dispatch: ${event.type}`);
    }
  }
}
