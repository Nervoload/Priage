// backend/src/modules/triage/triage.service.ts
// Triage assessments service.

import { Injectable, NotFoundException } from '@nestjs/common';
import { EventType } from '@prisma/client';

import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTriageAssessmentDto } from './dto/create-triage-assessment.dto';

@Injectable()
export class TriageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async createAssessment(dto: CreateTriageAssessmentDto) {
    const priorityScore = this.computePriorityScore(dto.ctasLevel);

    const { assessment, event } = await this.prisma.$transaction(async (tx) => {
      const encounter = await tx.encounter.findUnique({
        where: { id: dto.encounterId },
        select: { id: true, hospitalId: true },
      });
      if (!encounter) throw new NotFoundException(`Encounter ${dto.encounterId} not found`);
      if (encounter.hospitalId !== dto.hospitalId) {
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

    if (event) {
      this.events.dispatchEncounterEvent(event);
    }

    return assessment;
  }

  async listAssessments(encounterId: number) {
    return this.prisma.triageAssessment.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'asc' },
    });
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
