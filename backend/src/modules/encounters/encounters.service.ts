// backend/src/modules/encounters/encounters.service.ts
// encounters.service.ts

// Written by: John Surette
// Date Created: Dec 9 2025
// Last Edited: Feb 12 2026

// Business logic for encounters.
// Writes to Postgres via Prisma and emits domain events.
// Auth enforced at controller layer via JwtAuthGuard/PatientGuard.

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EncounterStatus, EventType, Prisma } from '@prisma/client';

import { EventsService } from '../events/events.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { EncounterListResponseDto, PatientEncounterDto } from './dto/encounter-response.dto';
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

  async createEncounter(
    hospitalId: number,
    dto: CreateEncounterDto,
    actor?: EncounterActor,
    correlationId?: string,
  ) {
    this.loggingService.info(
      'Creating new encounter',
      {
        service: 'EncountersService',
        operation: 'createEncounter',
        correlationId,
        hospitalId,
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
            hospitalId,
            patientId: dto.patientId,
            chiefComplaint: dto.chiefComplaint,
            details: dto.details,
          },
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                age: true,
                gender: true,
                preferredLanguage: true,
              },
            },
          },
        });

        const createdEvent = await this.events.emitEncounterEventTx(tx, {
          encounterId: created.id,
          hospitalId: created.hospitalId,
          type: EventType.ENCOUNTER_CREATED,
          metadata: {
            status: created.status,
          },
          actor,
        });

        return { encounter: created, event: createdEvent };
      });

      this.loggingService.info(
        'Encounter created successfully',
        {
          service: 'EncountersService',
          operation: 'createEncounter',
          correlationId,
          hospitalId,
          patientId: dto.patientId,
          encounterId: encounter.id,
        },
        {
          status: encounter.status,
          eventId: event.id,
          actorUserId: actor?.actorUserId,
          actorPatientId: actor?.actorPatientId,
        },
      );

      void this.events.dispatchEncounterEventAndMarkProcessed(event);

      return encounter;
    } catch (error) {
      this.loggingService.error(
        'Failed to create encounter',
        {
          service: 'EncountersService',
          operation: 'createEncounter',
          correlationId,
          hospitalId,
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

  async listEncounters(
    hospitalId: number,
    query: ListEncountersQueryDto,
    correlationId?: string,
  ): Promise<EncounterListResponseDto> {
    this.loggingService.info(
      'Listing encounters',
      {
        service: 'EncountersService',
        operation: 'listEncounters',
        correlationId,
        hospitalId,
      },
      {
        status: query.status,
        since: query.since,
        limit: query.limit,
      },
    );

    try {
      const where: Prisma.EncounterWhereInput = { hospitalId };

      // Filter by one or more statuses
      if (query.status && query.status.length > 0) {
        where.status = { in: query.status };
      }

      // Filter by created date
      if (query.since) {
        where.createdAt = { gte: query.since };
      }

      const limit = query.limit || 200;

      const [encounters, total] = await Promise.all([
        this.prisma.encounter.findMany({
          where,
          orderBy: [
            { currentPriorityScore: 'desc' },
            { createdAt: 'asc' },
          ],
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

      this.loggingService.info(
        'Encounters listed successfully',
        {
          service: 'EncountersService',
          operation: 'listEncounters',
          correlationId,
          hospitalId,
        },
        {
          count: encounters.length,
          total,
        },
      );

      return {
        data: encounters,
        total,
      };
    } catch (error) {
      this.loggingService.error(
        'Failed to list encounters',
        {
          service: 'EncountersService',
          operation: 'listEncounters',
          correlationId,
          hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          status: query.status,
        },
      );
      throw error;
    }
  }

  async getEncounter(hospitalId: number, encounterId: number, correlationId?: string) {
    this.loggingService.info(
      'Fetching encounter',
      {
        service: 'EncountersService',
        operation: 'getEncounter',
        correlationId,
        encounterId,
        hospitalId,
      },
    );

    try {
      const encounter = await this.prisma.encounter.findUnique({
        where: {
          id_hospitalId: {
            id: encounterId,
            hospitalId,
          },
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              age: true,
              gender: true,
              heightCm: true,
              weightKg: true,
              allergies: true,
              conditions: true,
              preferredLanguage: true,
              optionalHealthInfo: true,
            },
          },
          triageAssessments: { orderBy: { createdAt: 'asc' } },
          messages: { orderBy: { createdAt: 'asc' } },
          alerts: { orderBy: { createdAt: 'asc' } },
          assets: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!encounter) {
        this.loggingService.warn(
          'Encounter not found',
          {
            service: 'EncountersService',
            operation: 'getEncounter',
            correlationId,
            encounterId,
            hospitalId,
          },
        );
        throw new NotFoundException(`Encounter ${encounterId} not found`);
      }

      this.loggingService.info(
        'Encounter fetched successfully',
        {
          service: 'EncountersService',
          operation: 'getEncounter',
          correlationId,
          encounterId,
          hospitalId: encounter.hospitalId,
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
      this.loggingService.error(
        'Failed to fetch encounter',
        {
          service: 'EncountersService',
          operation: 'getEncounter',
          correlationId,
          encounterId,
          hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async confirm(hospitalId: number, encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(hospitalId, encounterId, 'confirm', actor, correlationId);
  }

  async markArrived(hospitalId: number, encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(hospitalId, encounterId, 'markArrived', actor, correlationId);
  }

  async createWaiting(hospitalId: number, encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(hospitalId, encounterId, 'createWaiting', actor, correlationId);
  }

  async startExam(hospitalId: number, encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(hospitalId, encounterId, 'startExam', actor, correlationId);
  }

  async discharge(hospitalId: number, encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(hospitalId, encounterId, 'discharge', actor, correlationId);
  }

  async cancel(hospitalId: number, encounterId: number, actor?: EncounterActor, correlationId?: string) {
    return this.transition(hospitalId, encounterId, 'cancel', actor, correlationId);
  }

  private async transition(
    hospitalId: number,
    encounterId: number,
    transitionKey: keyof typeof TRANSITIONS,
    actor?: EncounterActor,
    correlationId?: string,
  ) {
    const transition = TRANSITIONS[transitionKey];
    if (!transition) {
      this.loggingService.error(
        'Unknown transition attempted',
        {
          service: 'EncountersService',
          operation: 'transition',
          correlationId,
          encounterId,
          hospitalId,
        },
        new Error(`Unknown transition: ${String(transitionKey)}`),
        {
          transitionKey: String(transitionKey),
        },
      );
      throw new BadRequestException(`Unknown transition: ${String(transitionKey)}`);
    }

    this.loggingService.info(
      'Starting encounter transition',
      {
        service: 'EncountersService',
        operation: 'transition',
        correlationId,
        encounterId,
        hospitalId,
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
        const current = await tx.encounter.findUnique({
          where: {
            id_hospitalId: {
              id: encounterId,
              hospitalId,
            },
          },
        });
        if (!current) {
          this.loggingService.warn(
            'Encounter not found during transition',
            {
              service: 'EncountersService',
              operation: 'transition',
              correlationId,
              encounterId,
              hospitalId,
            },
            {
              transitionKey: String(transitionKey),
              targetStatus: transition.to,
            },
          );
          throw new NotFoundException(`Encounter ${encounterId} not found`);
        }

        if (TERMINAL_STATUSES.has(current.status)) {
          this.loggingService.warn(
            'Transition attempted on terminal status',
            {
              service: 'EncountersService',
              operation: 'transition',
              correlationId,
              encounterId,
              hospitalId,
            },
            {
              currentStatus: current.status,
              transitionKey: String(transitionKey),
            },
          );
          throw new BadRequestException(`Encounter ${encounterId} is terminal (${current.status})`);
        }

        if (!transition.allowedFrom.includes(current.status)) {
          this.loggingService.warn(
            'Invalid state transition attempted',
            {
              service: 'EncountersService',
              operation: 'transition',
              correlationId,
              encounterId,
              hospitalId,
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

        const updateResult = await tx.encounter.updateMany({
          where: {
            id: encounterId,
            hospitalId,
            status: current.status,
          },
          data: updateData,
        });
        if (updateResult.count !== 1) {
          throw new ConflictException(
            `Encounter ${encounterId} was updated by another request. Refresh and retry.`,
          );
        }

        const updated = await tx.encounter.findUnique({
          where: {
            id_hospitalId: {
              id: encounterId,
              hospitalId,
            },
          },
        });
        if (!updated) {
          throw new NotFoundException(`Encounter ${encounterId} not found`);
        }

        const createdEvent = await this.events.emitEncounterEventTx(tx, {
          encounterId: updated.id,
          hospitalId: updated.hospitalId,
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

      this.loggingService.info(
        'Encounter transition completed successfully',
        {
          service: 'EncountersService',
          operation: 'transition',
          correlationId,
          encounterId: encounter.id,
          hospitalId,
        },
        {
          fromStatus: event.metadata && typeof event.metadata === 'object' && 'fromStatus' in event.metadata ? event.metadata.fromStatus : undefined,
          toStatus: encounter.status,
          transitionKey: String(transitionKey),
          eventId: event.id,
          durationMs: duration,
          actorUserId: actor?.actorUserId,
          actorPatientId: actor?.actorPatientId,
        },
      );

      void this.events.dispatchEncounterEventAndMarkProcessed(event);

      return encounter;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        // These are expected validation errors, logged at warn level above
        throw error;
      }

      this.loggingService.error(
        'Encounter transition failed',
        {
          service: 'EncountersService',
          operation: 'transition',
          correlationId,
          encounterId,
          hospitalId,
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

  // ─── Patient-scoped access methods ──────────────────────────────────────────

  /**
   * Get an encounter from the patient's perspective.
   * Returns limited data — no triage assessments, no internal messages, no alerts.
   * Enforces that the patient owns this encounter.
   */
  async getEncounterForPatient(
    patientId: number,
    encounterId: number,
    hospitalId: number | null,
    correlationId?: string,
  ): Promise<PatientEncounterDto> {
    this.loggingService.info(
      'Patient fetching own encounter',
      {
        service: 'EncountersService',
        operation: 'getEncounterForPatient',
        correlationId,
        encounterId,
        patientId,
      },
    );

    // Use compound key when hospitalId is available (defense-in-depth)
    const encounter = hospitalId
      ? await this.prisma.encounter.findUnique({
          where: {
            id_hospitalId: {
              id: encounterId,
              hospitalId,
            },
          },
          include: {
            messages: {
              where: { isInternal: false },
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                createdAt: true,
                senderType: true,
                content: true,
                createdByUserId: true,
                createdByPatientId: true,
              },
            },
          },
        })
      : await this.prisma.encounter.findUnique({
          where: { id: encounterId },
          include: {
            messages: {
              where: { isInternal: false },
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                createdAt: true,
                senderType: true,
                content: true,
                createdByUserId: true,
                createdByPatientId: true,
              },
            },
          },
        });

    if (!encounter) {
      throw new NotFoundException(`Encounter ${encounterId} not found`);
    }

    if (encounter.patientId !== patientId) {
      throw new ForbiddenException('You can only view your own encounters');
    }

    return {
      id: encounter.id,
      createdAt: encounter.createdAt,
      status: encounter.status,
      chiefComplaint: encounter.chiefComplaint,
      details: encounter.details,
      hospitalId: encounter.hospitalId,
      expectedAt: encounter.expectedAt,
      arrivedAt: encounter.arrivedAt,
      messages: encounter.messages,
    };
  }

  /**
   * List all encounters belonging to a patient (limited view).
   */
  async listEncountersForPatient(
    patientId: number,
    correlationId?: string,
  ) {
    this.loggingService.info(
      'Patient listing own encounters',
      {
        service: 'EncountersService',
        operation: 'listEncountersForPatient',
        correlationId,
        patientId,
      },
    );

    const encounters = await this.prisma.encounter.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        status: true,
        chiefComplaint: true,
        hospitalId: true,
        expectedAt: true,
        arrivedAt: true,
      },
    });

    return encounters;
  }

  // ─── Wait time estimation ───────────────────────────────────────────────────

  /**
   * Estimate a patient's queue position and wait time.
   * Counts encounters ahead of them in WAITING status, ordered by priority.
   * Uses a naive average of 15 minutes per patient — replace with real averages
   * from completed encounters once enough data exists.
   */
  async getQueuePosition(
    encounterId: number,
    hospitalId: number,
    correlationId?: string,
  ): Promise<{
    position: number;
    estimatedMinutes: number;
    totalInQueue: number;
  }> {
    this.loggingService.info(
      'Calculating queue position',
      {
        service: 'EncountersService',
        operation: 'getQueuePosition',
        correlationId,
        encounterId,
        hospitalId,
      },
    );

    const waiting = await this.prisma.encounter.findMany({
      where: {
        hospitalId,
        status: EncounterStatus.WAITING,
      },
      orderBy: [
        { currentPriorityScore: 'desc' },
        { createdAt: 'asc' },
      ],
      select: { id: true },
    });

    const index = waiting.findIndex((e) => e.id === encounterId);

    const AVG_MINUTES_PER_PATIENT = 15;

    return {
      position: index === -1 ? 0 : index + 1,
      estimatedMinutes: index === -1 ? 0 : (index + 1) * AVG_MINUTES_PER_PATIENT,
      totalInQueue: waiting.length,
    };
  }
}
