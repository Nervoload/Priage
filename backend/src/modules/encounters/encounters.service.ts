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
  ) {
    this.logger.log('EncountersService initialized');
  }

  async createEncounter(dto: CreateEncounterDto, actor?: EncounterActor) {
    const logContext = {
      hospitalId: dto.hospitalId,
      patientId: dto.patientId,
      actorUserId: actor?.actorUserId,
      actorPatientId: actor?.actorPatientId,
    };

    this.logger.log({
      message: 'Creating new encounter',
      ...logContext,
    });

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

      this.logger.log({
        message: 'Encounter created successfully',
        encounterId: encounter.id,
        status: encounter.status,
        eventId: event?.id,
        ...logContext,
      });

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return encounter;
    } catch (error) {
      this.logger.error({
        message: 'Failed to create encounter',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...logContext,
      });
      throw error;
    }
  }

  async listEncounters(query: ListEncountersQueryDto): Promise<PaginatedResponse<any>> {
    this.logger.log({
      message: 'Listing encounters',
      status: query.status,
      hospitalId: query.hospitalId,
      page: query.page,
      limit: query.limit,
    });

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

      this.logger.log({
        message: 'Encounters listed successfully',
        count: encounters.length,
        total,
        page,
        totalPages,
      });

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
      this.logger.error({
        message: 'Failed to list encounters',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        status: query.status,
        hospitalId: query.hospitalId,
      });
      throw error;
    }
  }

  async getEncounter(encounterId: number) {
    this.logger.log({
      message: 'Fetching encounter',
      encounterId,
    });

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
        this.logger.warn({
          message: 'Encounter not found',
          encounterId,
        });
        throw new NotFoundException(`Encounter ${encounterId} not found`);
      }

      this.logger.log({
        message: 'Encounter fetched successfully',
        encounterId,
        status: encounter.status,
        hospitalId: encounter.hospitalId,
      });

      return encounter;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({
        message: 'Failed to fetch encounter',
        encounterId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async confirm(encounterId: number, actor?: EncounterActor) {
    return this.transition(encounterId, 'confirm', actor);
  }

  async markArrived(encounterId: number, actor?: EncounterActor) {
    return this.transition(encounterId, 'markArrived', actor);
  }

  async createWaiting(encounterId: number, actor?: EncounterActor) {
    return this.transition(encounterId, 'createWaiting', actor);
  }

  async startExam(encounterId: number, actor?: EncounterActor) {
    return this.transition(encounterId, 'startExam', actor);
  }

  async discharge(encounterId: number, actor?: EncounterActor) {
    return this.transition(encounterId, 'discharge', actor);
  }

  async cancel(encounterId: number, actor?: EncounterActor) {
    return this.transition(encounterId, 'cancel', actor);
  }

  private async transition(
    encounterId: number,
    transitionKey: keyof typeof TRANSITIONS,
    actor?: EncounterActor,
  ) {
    const transition = TRANSITIONS[transitionKey];
    if (!transition) {
      this.logger.error({
        message: 'Unknown transition attempted',
        encounterId,
        transitionKey: String(transitionKey),
      });
      throw new BadRequestException(`Unknown transition: ${String(transitionKey)}`);
    }

    const logContext = {
      encounterId,
      transitionKey: String(transitionKey),
      targetStatus: transition.to,
      actorUserId: actor?.actorUserId,
      actorPatientId: actor?.actorPatientId,
    };

    this.logger.log({
      message: 'Starting encounter transition',
      ...logContext,
    });

    const now = new Date();
    const startTime = Date.now();

    try {
      const { encounter, event } = await this.prisma.$transaction(async (tx) => {
        const current = await tx.encounter.findUnique({ where: { id: encounterId } });
        if (!current) {
          this.logger.warn({
            message: 'Encounter not found during transition',
            ...logContext,
          });
          throw new NotFoundException(`Encounter ${encounterId} not found`);
        }

        if (TERMINAL_STATUSES.has(current.status)) {
          this.logger.warn({
            message: 'Transition attempted on terminal status',
            encounterId,
            currentStatus: current.status,
            transitionKey: String(transitionKey),
          });
          throw new BadRequestException(`Encounter ${encounterId} is terminal (${current.status})`);
        }

        if (!transition.allowedFrom.includes(current.status)) {
          this.logger.warn({
            message: 'Invalid state transition attempted',
            encounterId,
            currentStatus: current.status,
            targetStatus: transition.to,
            transitionKey: String(transitionKey),
            allowedFrom: transition.allowedFrom,
          });
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

      this.logger.log({
        message: 'Encounter transition completed successfully',
        encounterId: encounter.id,
        fromStatus: event?.metadata && typeof event.metadata === 'object' && 'fromStatus' in event.metadata ? event.metadata.fromStatus : undefined,
        toStatus: encounter.status,
        transitionKey: String(transitionKey),
        eventId: event?.id,
        durationMs: duration,
        actorUserId: actor?.actorUserId,
        actorPatientId: actor?.actorPatientId,
      });

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

      this.logger.error({
        message: 'Encounter transition failed',
        ...logContext,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
