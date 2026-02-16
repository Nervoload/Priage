// backend/src/modules/triage/triage.service.ts
// Triage assessments service.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventType, Prisma } from '@prisma/client';

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
        painLevel: dto.painLevel,
      },
    );

    try {
      const priorityScore = this.computePriorityScore(dto.ctasLevel, dto.painLevel);

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
            chiefComplaint: dto.chiefComplaint,
            painLevel: dto.painLevel,
            vitalSigns: dto.vitalSigns
              ? (dto.vitalSigns as unknown as Prisma.InputJsonValue)
              : undefined,
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

  async getAssessment(assessmentId: number, hospitalId: number, correlationId?: string) {
    this.loggingService.debug(
      'Fetching triage assessment',
      {
        service: 'TriageService',
        operation: 'getAssessment',
        correlationId,
        assessmentId,
        hospitalId,
      },
    );

    const assessment = await this.prisma.triageAssessment.findFirst({
      where: { id: assessmentId, hospitalId },
    });

    if (!assessment) {
      throw new NotFoundException(`Triage assessment ${assessmentId} not found`);
    }

    return assessment;
  }

  // Phase 6.5: Add an AI suggestion method here, e.g.:
  //   async suggestTriageLevel(encounterId: number, hospitalId: number): Promise<{
  //     suggestedCtasLevel: number;
  //     suggestedPainLevel: number;
  //     reasoning: string;
  //     confidence: number;
  //   }>
  // This would fetch the encounter's chief complaint and vital signs, then call
  // an LLM or ML model to analyze the data and return a recommended CTAS level.
  // It sits alongside computePriorityScore() below, which handles deterministic
  // scoring after the triage level has been decided.

  /**
   * Compute a sortable priority score from CTAS level and optional pain level.
   * Higher score = more urgent = sorted first.
   *
   * Base: CTAS 1 → 100, CTAS 5 → 20
   * Pain bonus: up to +10 for pain level 10
   */
  private computePriorityScore(ctasLevel: number, painLevel?: number): number {
    const baseScores: Record<number, number> = {
      1: 100,
      2: 80,
      3: 60,
      4: 40,
      5: 20,
    };

    const base = baseScores[ctasLevel] ?? 0;
    const painBonus = painLevel != null ? Math.round(painLevel) : 0;
    return base + painBonus;
  }
}
