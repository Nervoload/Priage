// backend/src/modules/encounters/encounters.service.ts
// encounters.service.ts

// Written by: John Surette
// Date Created: Dec 9 2025
// Last Edited: Jan 6 2026

// Business logic for encounters.
// Writes to Postgres via Prisma and emits domain events.
// Auth is intentionally skipped; later enforce role rules here.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EncounterStatus, EventType, Prisma } from '@prisma/client';

import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { EventsService } from '../events/events.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { ListEncountersQueryDto } from './dto/list-encounters.query.dto';

export type EncounterActor = {
  actorUserId?: number;
  actorPatientId?: number;
};

type EncounterTransition = {
  to: EncounterStatus;
  allowedFrom: EncounterStatus[];
  timestampField?: keyof Prisma.EncounterUpdateInput;
  eventType?: EventType;
};

const TERMINAL_STATUSES = new Set<EncounterStatus>([
  EncounterStatus.COMPLETE,
  EncounterStatus.CANCELLED,
  EncounterStatus.UNRESOLVED,
]);

// TRANSTIONS --> changing Encounter.status throughout the lifecycle

const TRANSITIONS: Record<string, EncounterTransition> = {
  confirm: {
    to: EncounterStatus.ADMITTED,
    allowedFrom: [EncounterStatus.EXPECTED],
    timestampField: 'arrivedAt',
  },
  markArrived: {
    to: EncounterStatus.ADMITTED,
    allowedFrom: [EncounterStatus.EXPECTED],
    timestampField: 'arrivedAt',
  },
  createWaiting: {
    to: EncounterStatus.WAITING,
    allowedFrom: [EncounterStatus.ADMITTED, EncounterStatus.TRIAGE],
    timestampField: 'waitingAt',
  },
  startExam: {
    to: EncounterStatus.TRIAGE,
    allowedFrom: [EncounterStatus.ADMITTED, EncounterStatus.WAITING],
    timestampField: 'triagedAt',
  },
  discharge: {
    to: EncounterStatus.COMPLETE,
    allowedFrom: [EncounterStatus.ADMITTED, EncounterStatus.TRIAGE, EncounterStatus.WAITING],
    timestampField: 'departedAt',
  },
  cancel: {
    to: EncounterStatus.CANCELLED,
    allowedFrom: [
      EncounterStatus.EXPECTED,
      EncounterStatus.ADMITTED,
      EncounterStatus.TRIAGE,
      EncounterStatus.WAITING,
    ],
    timestampField: 'cancelledAt',
  },
};

@Injectable()
export class EncountersService {
  private readonly logger = new Logger(EncountersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly loggingService: LoggingService,
  ) {
    this.logger.log('EncountersService initialized');
  }

  async createEncounter(dto: CreateEncounterDto, actor?: EncounterActor, correlationId?: string) {
    await this.loggingService.info(
      'Creating new encounter',
      {
        service: 'EncountersService',
        operation: 'createEncounter',
        correlationId,
        hospitalId: dto.hospitalId,
        patientId: dto.patientId,
      },
      {
        actorUserId: actor?.actorUserId,
        actorPatientId: actor?.actorPatientId,
      },
    );

    try {
      const { encounter, event } = await this.prisma.$transaction(async (tx) => {
        const created = await tx.encounter.create({
          data: {
            status: EncounterStatus.EXPECTED,
            hospitalId: dto.hospitalId,
            patientId: dto.patientId,
            chiefComplaint: dto.chiefComplaint,
            details: dto.details,
          },
          include: {
            patient: true,
          },
        });

        const createdEvent = await this.events.emitEncounterEventTx(tx, {
          encounterId: created.id,
          hospitalId: created.hospitalId ?? undefined,
          type: EventType.ENCOUNTER_CREATED,
          metadata: {
            status: created.status,
          },
          actor,
        });

        return { encounter: created, event: createdEvent };
      });

      await this.loggingService.info(
        'Encounter created successfully',
        {
          service: 'EncountersService',
          operation: 'createEncounter',
          correlationId,
          hospitalId: dto.hospitalId,
          patientId: dto.patientId,
          encounterId: encounter.id,
        },
        {
          status: encounter.status,
          eventId: event?.id,
          actorUserId: actor?.actorUserId,
          actorPatientId: actor?.actorPatientId,
        },
      );

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return encounter;
    } catch (error) {
      await this.loggingService.error(
        'Failed to create encounter',
        {
          service: 'EncountersService',
          operation: 'createEncounter',
          correlationId,
          hospitalId: dto.hospitalId,
          patientId: dto.patientId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          actorUserId: actor?.actorUserId,
          actorPatientId: actor?.actorPatientId,
        },
      );
      throw error;
    }
  }

  async listEncounters(query: ListEncountersQueryDto, correlationId?: string): Promise<PaginatedResponse<any>> {
    await this.loggingService.info(
      'Listing encounters',
      {
        service: 'EncountersService',
        operation: 'listEncounters',
        correlationId,
        hospitalId: query.hospitalId,
      },
      {
        status: query.status,
        page: query.page,
        limit: query.limit,
      },
    );

    try {
      const where: Prisma.EncounterWhereInput = {};

      if (query.status) where.status = query.status;
      if (query.hospitalId) where.hospitalId = query.hospitalId;

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [encounters, total] = await Promise.all([
        this.prisma.encounter.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                age: true,
              },
            },
          },
        }),
        this.prisma.encounter.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      await this.loggingService.info(
        'Encounters listed successfully',
        {
          service: 'EncountersService',
          operation: 'listEncounters',
          correlationId,
          hospitalId: query.hospitalId,
        },
        {
          count: encounters.length,
          total,
          page,
          totalPages,
        },
      );

      return {
        data: encounters,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      await this.loggingService.error(
        'Failed to list encounters',
        {
          service: 'EncountersService',
          operation: 'listEncounters',
          correlationId,
          hospitalId: query.hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          status: query.status,
        },
      );
      throw error;
    }
  }

  async getEncounter(encounterId: number, correlationId?: string) {
    await this.loggingService.info(
      'Fetching encounter',
      {
        service: 'EncountersService',
        operation: 'getEncounter',
        correlationId,
        encounterId,
      },
    );

    try {
      const encounter = await this.prisma.encounter.findUnique({
        where: { id: encounterId },
        include: {
          patient: true,
          triageAssessments: { orderBy: { createdAt: 'asc' } },
          messages: { orderBy: { createdAt: 'asc' } },
          alerts: { orderBy: { createdAt: 'asc' } },
          assets: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!encounter) {
        await this.loggingService.warn(
          'Encounter not found',
          {
            service: 'EncountersService',
            operation: 'getEncounter',
            correlationId,
            encounterId,
          },
        );
        throw new NotFoundException(`Encounter ${encounterId} not found`);
      }

      await this.loggingService.info(
        'Encounter fetched successfully',
        {
          service: 'EncountersService',
          operation: 'getEncounter',
          correlationId,
          encounterId,
          hospitalId: encounter.hospitalId ?? undefined,
        },
        {
          status: encounter.status,
        },
      );

      return encounter;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      await this.loggingService.error(
        'Failed to fetch encounter',
        {
          service: 'EncountersService',
          operation: 'getEncounter',
          correlationId,
          encounterId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async confirm(encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(encounterId, 'confirm', actor, correlationId);
  }

  async markArrived(encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(encounterId, 'markArrived', actor, correlationId);
  }

  async createWaiting(encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(encounterId, 'createWaiting', actor, correlationId);
  }

  async startExam(encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(encounterId, 'startExam', actor, correlationId);
  }

  async discharge(encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(encounterId, 'discharge', actor, correlationId);
  }

  async cancel(encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(encounterId, 'cancel', actor, correlationId);
  }

  private async transition(
    encounterId: number,
    transitionKey: keyof typeof TRANSITIONS,
    actor?: EncounterActor,
    correlationId?: string,
  ) {
    const transition = TRANSITIONS[transitionKey];
    if (!transition) {
      await this.loggingService.error(
        'Unknown transition attempted',
        {
          service: 'EncountersService',
          operation: 'transition',
          correlationId,
          encounterId,
        },
        new Error(`Unknown transition: ${String(transitionKey)}`),
        {
          transitionKey: String(transitionKey),
        },
      );
      throw new BadRequestException(`Unknown transition: ${String(transitionKey)}`);
    }

    await this.loggingService.info(
      'Starting encounter transition',
      {
        service: 'EncountersService',
        operation: 'transition',
        correlationId,
        encounterId,
      },
      {
        transitionKey: String(transitionKey),
        targetStatus: transition.to,
        actorUserId: actor?.actorUserId,
        actorPatientId: actor?.actorPatientId,
      },
    );

    const now = new Date();
    const startTime = Date.now();

    try {
      const { encounter, event } = await this.prisma.$transaction(async (tx) => {
        const current = await tx.encounter.findUnique({ where: { id: encounterId } });
        if (!current) {
          await this.loggingService.warn(
            'Encounter not found during transition',
            {
              service: 'EncountersService',
              operation: 'transition',
              correlationId,
              encounterId,
            },
            {
              transitionKey: String(transitionKey),
              targetStatus: transition.to,
            },
          );
          throw new NotFoundException(`Encounter ${encounterId} not found`);
        }

        if (TERMINAL_STATUSES.has(current.status)) {
          await this.loggingService.warn(
            'Transition attempted on terminal status',
            {
              service: 'EncountersService',
              operation: 'transition',
              correlationId,
              encounterId,
            },
            {
              currentStatus: current.status,
              transitionKey: String(transitionKey),
            },
          );
          throw new BadRequestException(`Encounter ${encounterId} is terminal (${current.status})`);
        }

        if (!transition.allowedFrom.includes(current.status)) {
          await this.loggingService.warn(
            'Invalid state transition attempted',
            {
              service: 'EncountersService',
              operation: 'transition',
              correlationId,
              encounterId,
            },
            {
              currentStatus: current.status,
              targetStatus: transition.to,
              transitionKey: String(transitionKey),
              allowedFrom: transition.allowedFrom,
            },
          );
          throw new BadRequestException(
            `Invalid transition ${transitionKey} from ${current.status} to ${transition.to}`,
          );
        }

      const updateData: Prisma.EncounterUpdateInput = {
        status: transition.to,
      };

      if (transition.timestampField) {
        const timestampField = transition.timestampField as keyof typeof current;
        if (!current[timestampField]) {
          updateData[transition.timestampField] = now;
        }
      }

      const updated = await tx.encounter.update({
        where: { id: encounterId },
        data: updateData,
      });

      const createdEvent = await this.events.emitEncounterEventTx(tx, {
        encounterId: updated.id,
        hospitalId: updated.hospitalId ?? undefined,
        type: EventType.STATUS_CHANGE,
        metadata: {
          fromStatus: current.status,
          toStatus: updated.status,
          transition: transitionKey,
          timestamps: {
            arrivedAt: updated.arrivedAt,
            triagedAt: updated.triagedAt,
            waitingAt: updated.waitingAt,
            seenAt: updated.seenAt,
            departedAt: updated.departedAt,
            cancelledAt: updated.cancelledAt,
          },
        },
        actor,
      });

      return { encounter: updated, event: createdEvent };
      });

      const duration = Date.now() - startTime;

      await this.loggingService.info(
        'Encounter transition completed successfully',
        {
          service: 'EncountersService',
          operation: 'transition',
          correlationId,
          encounterId: encounter.id,
        },
        {
          fromStatus: event?.metadata && typeof event.metadata === 'object' && 'fromStatus' in event.metadata ? event.metadata.fromStatus : undefined,
          toStatus: encounter.status,
          transitionKey: String(transitionKey),
          eventId: event?.id,
          durationMs: duration,
          actorUserId: actor?.actorUserId,
          actorPatientId: actor?.actorPatientId,
        },
      );

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return encounter;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        // These are expected validation errors, logged at warn level above
        throw error;
      }

      await this.loggingService.error(
        'Encounter transition failed',
        {
          service: 'EncountersService',
          operation: 'transition',
          correlationId,
          encounterId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          transitionKey: String(transitionKey),
          targetStatus: transition.to,
          durationMs: duration,
          actorUserId: actor?.actorUserId,
          actorPatientId: actor?.actorPatientId,
        },
      );
      throw error;
    }
  }
}
