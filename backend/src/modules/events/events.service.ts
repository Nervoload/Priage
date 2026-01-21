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

  constructor(private readonly realtime: RealtimeGateway) {
    this.logger.log('EventsService initialized');
  }

  async emitEncounterEventTx(
    tx: Prisma.TransactionClient,
    args: EmitEncounterEventArgs,
  ): Promise<EncounterEvent | null> {
    const logContext = {
      encounterId: args.encounterId,
      hospitalId: args.hospitalId,
      eventType: args.type,
      actorUserId: args.actor?.actorUserId,
      actorPatientId: args.actor?.actorPatientId,
    };

    if (!args.hospitalId) {
      this.logger.warn({
        message: 'Skipping encounter event without hospitalId',
        ...logContext,
      });
      return null;
    }

    try {
      this.logger.debug({
        message: 'Creating encounter event in transaction',
        ...logContext,
      });

      const event = await tx.encounterEvent.create({
        data: {
          encounterId: args.encounterId,
          hospitalId: args.hospitalId,
          type: args.type,
          metadata: args.metadata,
          actorUserId: args.actor?.actorUserId,
          actorPatientId: args.actor?.actorPatientId,
        },
      });

      this.logger.log({
        message: 'Encounter event created',
        eventId: event.id,
        ...logContext,
      });

      return event;
    } catch (error) {
      this.logger.error({
        message: 'Failed to create encounter event in transaction',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...logContext,
      });
      throw error;
    }
  }

  dispatchEncounterEvent(event: EncounterEvent): void {
    const logContext = {
      eventId: event.id,
      eventType: event.type,
      encounterId: event.encounterId,
      hospitalId: event.hospitalId,
    };

    this.logger.debug({
      message: 'Dispatching encounter event',
      ...logContext,
    });

    try {
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
          this.logger.debug({
            message: 'Unhandled event type for realtime dispatch',
            ...logContext,
          });
      }

      this.logger.log({
        message: 'Event dispatched successfully',
        ...logContext,
      });
    } catch (error) {
      // CRITICAL: Event dispatch failures should not break the transaction
      // Log error but don't throw - this allows database changes to complete
      // even if WebSocket notification fails
      this.logger.error({
        message: 'Failed to dispatch encounter event to realtime',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...logContext,
      });
      // TODO: Implement dead letter queue or retry mechanism for failed dispatches
    }
  }
}
