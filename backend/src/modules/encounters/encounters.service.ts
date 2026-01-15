// backend/src/modules/encounters/encounters.service.ts
// encounters.service.ts

// Written by: John Surette
// Date Created: Dec 9 2025
// Last Edited: Jan 6 2026

// Business logic for encounters.
// Writes to Postgres via Prisma and emits domain events.
// Auth is intentionally skipped; later enforce role rules here.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EncounterStatus, EventType, Prisma } from '@prisma/client';

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
    timestampField: 'seenAt',
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async createEncounter(dto: CreateEncounterDto, actor?: EncounterActor) {
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

    if (event) {
      this.events.dispatchEncounterEvent(event);
    }

    return encounter;
  }

  async listEncounters(query: ListEncountersQueryDto) {
    const where: Prisma.EncounterWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.hospitalId) where.hospitalId = query.hospitalId;

    return this.prisma.encounter.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        patient: true,
      },
    });
  }

  async getEncounter(encounterId: number) {
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
      throw new NotFoundException(`Encounter ${encounterId} not found`);
    }

    return encounter;
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
      throw new BadRequestException(`Unknown transition: ${String(transitionKey)}`);
    }

    const now = new Date();

    const { encounter, event } = await this.prisma.$transaction(async (tx) => {
      const current = await tx.encounter.findUnique({ where: { id: encounterId } });
      if (!current) throw new NotFoundException(`Encounter ${encounterId} not found`);

      if (TERMINAL_STATUSES.has(current.status)) {
        throw new BadRequestException(`Encounter ${encounterId} is terminal (${current.status})`);
      }

      if (!transition.allowedFrom.includes(current.status)) {
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

    if (event) {
      this.events.dispatchEncounterEvent(event);
    }

    return encounter;
  }
}
