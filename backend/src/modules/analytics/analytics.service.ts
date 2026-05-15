// backend/src/modules/analytics/analytics.service.ts
// Hospital analytics data access.

import { Injectable } from '@nestjs/common';
import { Prisma, SenderType } from '@prisma/client';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { GetHospitalAnalyticsQueryDto, AnalyticsRange } from './dto/get-hospital-analytics.query.dto';
import {
  HospitalAnalyticsEncounterRowDto,
  HospitalAnalyticsResponseDto,
} from './dto/hospital-analytics-response.dto';

const RANGE_DAYS: Record<Exclude<AnalyticsRange, 'all'>, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

const ANALYTICS_ENCOUNTER_SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  chiefComplaint: true,
  currentCtasLevel: true,
  currentPriorityScore: true,
  arrivedAt: true,
  triagedAt: true,
  waitingAt: true,
  seenAt: true,
  departedAt: true,
  cancelledAt: true,
} satisfies Prisma.EncounterSelect;

function getSince(range: AnalyticsRange): Date | null {
  if (range === 'all') {
    return null;
  }

  const since = new Date();
  since.setDate(since.getDate() - RANGE_DAYS[range]);
  return since;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async getHospitalAnalytics(
    hospitalId: number,
    query: GetHospitalAnalyticsQueryDto,
    correlationId?: string,
  ): Promise<HospitalAnalyticsResponseDto> {
    const range = query.range ?? 'week';
    const since = getSince(range);

    this.loggingService.info(
      'Loading hospital analytics',
      {
        service: 'AnalyticsService',
        operation: 'getHospitalAnalytics',
        correlationId,
        hospitalId,
      },
      { range, since: since?.toISOString() ?? null },
    );

    const where: Prisma.EncounterWhereInput = {
      hospitalId,
      ...(since ? { createdAt: { gte: since } } : {}),
    };

    const encounters = await this.prisma.encounter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: ANALYTICS_ENCOUNTER_SELECT,
    });

    const encounterIds = encounters.map((encounter) => encounter.id);

    if (encounterIds.length === 0) {
      return {
        hospitalId,
        range,
        since,
        generatedAt: new Date(),
        total: 0,
        data: [],
      };
    }

    const [triageCounts, messageCounts, patientMessageStats] = await Promise.all([
      this.prisma.triageAssessment.groupBy({
        by: ['encounterId'],
        where: {
          hospitalId,
          encounterId: { in: encounterIds },
        },
        _count: { _all: true },
      }),
      this.prisma.message.groupBy({
        by: ['encounterId'],
        where: {
          hospitalId,
          encounterId: { in: encounterIds },
        },
        _count: { _all: true },
      }),
      this.prisma.message.groupBy({
        by: ['encounterId'],
        where: {
          hospitalId,
          encounterId: { in: encounterIds },
          senderType: SenderType.PATIENT,
        },
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
    ]);

    const triageCountByEncounter = new Map<number, number>(
      triageCounts.map((row) => [row.encounterId, row._count._all]),
    );
    const messageCountByEncounter = new Map<number, number>(
      messageCounts.map((row) => [row.encounterId, row._count._all]),
    );
    const patientMessageStatsByEncounter = new Map<
      number,
      { count: number; first: Date | null; last: Date | null }
    >(
      patientMessageStats.map((row) => [
        row.encounterId,
        {
          count: row._count._all,
          first: row._min.createdAt ?? null,
          last: row._max.createdAt ?? null,
        },
      ]),
    );

    const data: HospitalAnalyticsEncounterRowDto[] = encounters.map((encounter) => {
      const patientStats = patientMessageStatsByEncounter.get(encounter.id);

      return {
        ...encounter,
        triageAssessmentCount: triageCountByEncounter.get(encounter.id) ?? 0,
        messageCount: messageCountByEncounter.get(encounter.id) ?? 0,
        patientMessageCount: patientStats?.count ?? 0,
        firstPatientMessageAt: patientStats?.first ?? null,
        lastPatientMessageAt: patientStats?.last ?? null,
      };
    });

    return {
      hospitalId,
      range,
      since,
      generatedAt: new Date(),
      total: data.length,
      data,
    };
  }
}
