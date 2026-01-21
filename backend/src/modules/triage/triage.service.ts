// backend/src/modules/triage/triage.service.ts
// Triage assessments service.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventType } from '@prisma/client';

import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTriageAssessmentDto } from './dto/create-triage-assessment.dto';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {
    this.logger.log('TriageService initialized');
  }

  async createAssessment(dto: CreateTriageAssessmentDto) {
    const logContext = {
      encounterId: dto.encounterId,
      hospitalId: dto.hospitalId,
      ctasLevel: dto.ctasLevel,
      createdByUserId: dto.createdByUserId,
    };

    this.logger.log({
      message: 'Creating triage assessment',
      ...logContext,
    });

    try {
      const priorityScore = this.computePriorityScore(dto.ctasLevel);

      const { assessment, event } = await this.prisma.$transaction(async (tx) => {
        const encounter = await tx.encounter.findUnique({
          where: { id: dto.encounterId },
          select: { id: true, hospitalId: true },
        });
        if (!encounter) {
          this.logger.warn({
            message: 'Encounter not found for triage',
            encounterId: dto.encounterId,
          });
          throw new NotFoundException(`Encounter ${dto.encounterId} not found`);
        }
        if (encounter.hospitalId !== dto.hospitalId) {
          this.logger.warn({
            message: 'Encounter does not belong to hospital',
            encounterId: dto.encounterId,
            encounterHospitalId: encounter.hospitalId,
            requestedHospitalId: dto.hospitalId,
          });
          throw new NotFoundException('Encounter does not belong to hospital');
        }

        const created = await tx.triageAssessment.create({
          data: {
            encounterId: dto.encounterId,
            hospitalId: dto.hospitalId,
            ctasLevel: dto.ctasLevel,
            priorityScore,
            note: dto.note,
            createdByUserId: dto.createdByUserId,
          },
        });

        await tx.encounter.update({
          where: { id: dto.encounterId },
          data: {
            currentTriageId: created.id,
            currentCtasLevel: created.ctasLevel,
            currentPriorityScore: created.priorityScore,
            triagedAt: new Date(),
          },
        });

        const createdEvent = await this.events.emitEncounterEventTx(tx, {
          encounterId: dto.encounterId,
          hospitalId: dto.hospitalId,
          type: EventType.TRIAGE_CREATED,
          metadata: {
            triageId: created.id,
            ctasLevel: created.ctasLevel,
            priorityScore: created.priorityScore,
          },
          actor: { actorUserId: dto.createdByUserId },
        });

        return { assessment: created, event: createdEvent };
      });

      this.logger.log({
        message: 'Triage assessment created successfully',
        triageId: assessment.id,
        priorityScore: assessment.priorityScore,
        eventId: event?.id,
        encounterId: dto.encounterId,
        hospitalId: dto.hospitalId,
        createdByUserId: dto.createdByUserId,
      });

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return assessment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({
        message: 'Failed to create triage assessment',
        ...logContext,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async listAssessments(encounterId: number) {
    this.logger.debug({
      message: 'Listing triage assessments',
      encounterId,
    });

    try {
      const assessments = await this.prisma.triageAssessment.findMany({
        where: { encounterId },
        orderBy: { createdAt: 'asc' },
      });

      this.logger.debug({
        message: 'Triage assessments retrieved',
        encounterId,
        count: assessments.length,
      });

      return assessments;
    } catch (error) {
      this.logger.error({
        message: 'Failed to list triage assessments',
        encounterId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private computePriorityScore(ctasLevel: number): number {
    const baseScores: Record<number, number> = {
      1: 100,
      2: 80,
      3: 60,
      4: 40,
      5: 20,
    };

    return baseScores[ctasLevel] ?? 0;
  }
}
