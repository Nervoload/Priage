// backend/src/modules/events/events.service.ts
// Domain event helpers for encounter-centric events.

import { Injectable, Logger } from '@nestjs/common';
import { EncounterEvent, EventType, Prisma } from '@prisma/client';

import { LoggingService } from '../logging/logging.service';
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

  constructor(
    private readonly realtime: RealtimeGateway,
    private readonly loggingService: LoggingService,
  ) {
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
      await this.loggingService.warn(
        'Skipping encounter event without hospitalId',
        {
          service: 'EventsService',
          operation: 'emitEncounterEventTx',
          correlationId: undefined,
          encounterId: args.encounterId,
        },
        {
          eventType: args.type,
          actorUserId: args.actor?.actorUserId,
          actorPatientId: args.actor?.actorPatientId,
        },
      );
      return null;
    }

    try {
      await this.loggingService.debug(
        'Creating encounter event in transaction',
        {
          service: 'EventsService',
          operation: 'emitEncounterEventTx',
          correlationId: undefined,
          encounterId: args.encounterId,
          hospitalId: args.hospitalId,
        },
        {
          eventType: args.type,
          actorUserId: args.actor?.actorUserId,
          actorPatientId: args.actor?.actorPatientId,
        },
      );

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

      await this.loggingService.info(
        'Encounter event created',
        {
          service: 'EventsService',
          operation: 'emitEncounterEventTx',
          correlationId: undefined,
          encounterId: args.encounterId,
          hospitalId: args.hospitalId,
        },
        {
          eventId: event.id,
          eventType: args.type,
          actorUserId: args.actor?.actorUserId,
          actorPatientId: args.actor?.actorPatientId,
        },
      );

      return event;
    } catch (error) {
      await this.loggingService.error(
        'Failed to create encounter event in transaction',
        {
          service: 'EventsService',
          operation: 'emitEncounterEventTx',
          correlationId: undefined,
          encounterId: args.encounterId,
          hospitalId: args.hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          eventType: args.type,
          actorUserId: args.actor?.actorUserId,
          actorPatientId: args.actor?.actorPatientId,
        },
      );
      throw error;
    }
  }

  dispatchEncounterEvent(event: EncounterEvent): void {
    this.loggingService.debug(
      'Dispatching encounter event',
      {
        service: 'EventsService',
        operation: 'dispatchEncounterEvent',
        correlationId: undefined,
        eventId: event.id,
        encounterId: event.encounterId,
        hospitalId: event.hospitalId,
      },
      {
        eventType: event.type,
      },
    ).catch(() => {}); // Fire and forget

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
          this.loggingService.debug(
            'Unhandled event type for realtime dispatch',
            {
              service: 'EventsService',
              operation: 'dispatchEncounterEvent',
              correlationId: undefined,
              eventId: event.id,
              encounterId: event.encounterId,
              hospitalId: event.hospitalId,
            },
            {
              eventType: event.type,
            },
          ).catch(() => {}); // Fire and forget
      }

      this.loggingService.info(
        'Event dispatched successfully',
        {
          service: 'EventsService',
          operation: 'dispatchEncounterEvent',
          correlationId: undefined,
          eventId: event.id,
          encounterId: event.encounterId,
          hospitalId: event.hospitalId,
        },
        {
          eventType: event.type,
        },
      ).catch(() => {}); // Fire and forget
    } catch (error) {
      // CRITICAL: Event dispatch failures should not break the transaction
      // Log error but don't throw - this allows database changes to complete
      // even if WebSocket notification fails
      this.loggingService.error(
        'Failed to dispatch encounter event to realtime',
        {
          service: 'EventsService',
          operation: 'dispatchEncounterEvent',
          correlationId: undefined,
          eventId: event.id,
          encounterId: event.encounterId,
          hospitalId: event.hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          eventType: event.type,
        },
      ).catch(() => {}); // Fire and forget
      // TODO: Implement dead letter queue or retry mechanism for failed dispatches
    }
  }
}
