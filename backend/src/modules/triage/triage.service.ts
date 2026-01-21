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

  async createAssessment(dto: CreateTriageAssessmentDto, correlationId?: string) {
    await this.loggingService.info(
      'Creating triage assessment',
      {
        service: 'TriageService',
        operation: 'createAssessment',
        correlationId,
        encounterId: dto.encounterId,
        hospitalId: dto.hospitalId,
        userId: dto.createdByUserId,
      },
      {
        ctasLevel: dto.ctasLevel,
      },
    );

    try {
      const priorityScore = this.computePriorityScore(dto.ctasLevel);

      const { assessment, event } = await this.prisma.$transaction(async (tx) => {
        const encounter = await tx.encounter.findUnique({
          where: { id: dto.encounterId },
          select: { id: true, hospitalId: true },
        });
        if (!encounter) {
          await this.loggingService.warn(
            'Encounter not found for triage',
            {
              service: 'TriageService',
              operation: 'createAssessment',
              correlationId,
              encounterId: dto.encounterId,
            },
          );
          throw new NotFoundException(`Encounter ${dto.encounterId} not found`);
        }
        if (encounter.hospitalId !== dto.hospitalId) {
          await this.loggingService.warn(
            'Encounter does not belong to hospital',
            {
              service: 'TriageService',
              operation: 'createAssessment',
              correlationId,
              encounterId: dto.encounterId,
              hospitalId: dto.hospitalId,
            },
            {
              encounterHospitalId: encounter.hospitalId,
              requestedHospitalId: dto.hospitalId,
            },
          );
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

      await this.loggingService.info(
        'Triage assessment created successfully',
        {
          service: 'TriageService',
          operation: 'createAssessment',
          correlationId,
          encounterId: dto.encounterId,
          hospitalId: dto.hospitalId,
          userId: dto.createdByUserId,
        },
        {
          triageId: assessment.id,
          priorityScore: assessment.priorityScore,
          eventId: event?.id,
        },
      );

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return assessment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      await this.loggingService.error(
        'Failed to create triage assessment',
        {
          service: 'TriageService',
          operation: 'createAssessment',
          correlationId,
          encounterId: dto.encounterId,
          hospitalId: dto.hospitalId,
          userId: dto.createdByUserId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          ctasLevel: dto.ctasLevel,
        },
      );
      throw error;
    }
  }

  async listAssessments(encounterId: number, correlationId?: string) {
    await this.loggingService.debug(
      'Listing triage assessments',
      {
        service: 'TriageService',
        operation: 'listAssessments',
        correlationId,
        encounterId,
      },
    );

    try {
      const assessments = await this.prisma.triageAssessment.findMany({
        where: { encounterId },
        orderBy: { createdAt: 'asc' },
      });

      await this.loggingService.debug(
        'Triage assessments retrieved',
        {
          service: 'TriageService',
          operation: 'listAssessments',
          correlationId,
          encounterId,
        },
        {
          count: assessments.length,
        },
      );

      return assessments;
    } catch (error) {
      await this.loggingService.error(
        'Failed to list triage assessments',
        {
          service: 'TriageService',
          operation: 'listAssessments',
          correlationId,
          encounterId,
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
