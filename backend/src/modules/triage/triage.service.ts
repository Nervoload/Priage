// backend/src/modules/triage/triage.service.ts
// Triage assessments service.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventType } from '@prisma/client';

import { EventsService } from '../events/events.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTriageAssessmentDto } from './dto/create-triage-assessment.dto';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly loggingService: LoggingService,
  ) {
    this.logger.log('TriageService initialized');
  }

  async createAssessment(
    dto: CreateTriageAssessmentDto,
    hospitalId: number,
    createdByUserId: number,
    correlationId?: string,
  ) {
    this.loggingService.info(
      'Creating triage assessment',
      {
        service: 'TriageService',
        operation: 'createAssessment',
        correlationId,
        encounterId: dto.encounterId,
        hospitalId,
        userId: createdByUserId,
      },
      {
        ctasLevel: dto.ctasLevel,
      },
    );

    try {
      const priorityScore = this.computePriorityScore(dto.ctasLevel);

      const { assessment, event } = await this.prisma.$transaction(async (tx) => {
        const encounter = await tx.encounter.findUnique({
          where: {
            id_hospitalId: {
              id: dto.encounterId,
              hospitalId,
            },
          },
          select: { id: true, hospitalId: true },
        });
        if (!encounter) {
          this.loggingService.warn(
            'Encounter not found for triage',
            {
              service: 'TriageService',
              operation: 'createAssessment',
              correlationId,
              encounterId: dto.encounterId,
              hospitalId,
            },
          );
          throw new NotFoundException(`Encounter ${dto.encounterId} not found for hospital`);
        }

        const created = await tx.triageAssessment.create({
          data: {
            encounterId: dto.encounterId,
            hospitalId,
            ctasLevel: dto.ctasLevel,
            priorityScore,
            note: dto.note,
            createdByUserId,
          },
        });

        await tx.encounter.update({
          where: {
            id_hospitalId: {
              id: dto.encounterId,
              hospitalId,
            },
          },
          data: {
            currentTriageId: created.id,
            currentCtasLevel: created.ctasLevel,
            currentPriorityScore: created.priorityScore,
            triagedAt: new Date(),
          },
        });

        const createdEvent = await this.events.emitEncounterEventTx(tx, {
          encounterId: dto.encounterId,
          hospitalId,
          type: EventType.TRIAGE_CREATED,
          metadata: {
            triageId: created.id,
            ctasLevel: created.ctasLevel,
            priorityScore: created.priorityScore,
          },
          actor: { actorUserId: createdByUserId },
        });

        return { assessment: created, event: createdEvent };
      });

      this.loggingService.info(
        'Triage assessment created successfully',
        {
          service: 'TriageService',
          operation: 'createAssessment',
          correlationId,
          encounterId: dto.encounterId,
          hospitalId,
          userId: createdByUserId,
        },
        {
          triageId: assessment.id,
          priorityScore: assessment.priorityScore,
          eventId: event.id,
        },
      );

      void this.events.dispatchEncounterEventAndMarkProcessed(event);

      return assessment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.loggingService.error(
        'Failed to create triage assessment',
        {
          service: 'TriageService',
          operation: 'createAssessment',
          correlationId,
          encounterId: dto.encounterId,
          hospitalId,
          userId: createdByUserId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          ctasLevel: dto.ctasLevel,
        },
      );
      throw error;
    }
  }

  async listAssessments(encounterId: number, hospitalId: number, correlationId?: string) {
    this.loggingService.debug(
      'Listing triage assessments',
      {
        service: 'TriageService',
        operation: 'listAssessments',
        correlationId,
        encounterId,
        hospitalId,
      },
    );

    try {
      const assessments = await this.prisma.triageAssessment.findMany({
        where: { encounterId, hospitalId },
        orderBy: { createdAt: 'asc' },
      });

      this.loggingService.debug(
        'Triage assessments retrieved',
        {
          service: 'TriageService',
          operation: 'listAssessments',
          correlationId,
          encounterId,
          hospitalId,
        },
        {
          count: assessments.length,
        },
      );

      return assessments;
    } catch (error) {
      this.loggingService.error(
        'Failed to list triage assessments',
        {
          service: 'TriageService',
          operation: 'listAssessments',
          correlationId,
          encounterId,
          hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
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
