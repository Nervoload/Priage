// backend/src/modules/events/events.service.ts
// Domain event helpers for encounter-centric events.

import { Injectable, Logger } from '@nestjs/common';
import { EncounterEvent, EventType, Prisma } from '@prisma/client';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  EncounterUpdatedPayload,
  MessageCreatedPayload,
  AlertCreatedPayload,
  AlertAcknowledgedPayload,
  AlertResolvedPayload,
} from '../realtime/realtime.events';

export type EncounterEventActor = {
  actorUserId?: number;
  actorPatientId?: number;
};

export type EmitEncounterEventArgs = {
  encounterId: number;
  hospitalId: number;
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
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('EventsService initialized');
  }

  async emitEncounterEventTx(
    tx: Prisma.TransactionClient,
    args: EmitEncounterEventArgs,
  ): Promise<EncounterEvent> {
    try {
      this.loggingService.debug(
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

      this.loggingService.info(
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
      this.loggingService.error(
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

  async dispatchEncounterEvent(event: EncounterEvent): Promise<boolean> {
    try {
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
      );

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
          this.realtime.emitEncounterUpdated(event.hospitalId, event.encounterId, payloadBase as EncounterUpdatedPayload);
          break;
        case EventType.MESSAGE_CREATED:
          this.realtime.emitMessageCreated(event.hospitalId, event.encounterId, payloadBase as MessageCreatedPayload);
          break;
        case EventType.ALERT_CREATED:
          this.realtime.emitAlertCreated(event.hospitalId, event.encounterId, payloadBase as AlertCreatedPayload);
          break;
        case EventType.ALERT_ACKNOWLEDGED:
          this.realtime.emitAlertAcknowledged(event.hospitalId, event.encounterId, payloadBase as unknown as AlertAcknowledgedPayload);
          break;
        case EventType.ALERT_RESOLVED:
          this.realtime.emitAlertResolved(event.hospitalId, event.encounterId, payloadBase as unknown as AlertResolvedPayload);
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
          );
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
      );
      return true;
    } catch (error) {
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
      );
      return false;
    }
  }

  async dispatchEncounterEventAndMarkProcessed(event: EncounterEvent): Promise<boolean> {
    if (event.processedAt) {
      return true;
    }

    const dispatched = await this.dispatchEncounterEvent(event);
    if (!dispatched) {
      return false;
    }

    await this.prisma.encounterEvent.updateMany({
      where: { id: event.id, processedAt: null },
      data: { processedAt: new Date() },
    });

    return true;
  }

  async dispatchEncounterEventById(eventId: number): Promise<boolean> {
    const event = await this.prisma.encounterEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      return true;
    }
    if (event.processedAt) {
      return true;
    }

    return this.dispatchEncounterEventAndMarkProcessed(event);
  }
}
