// backend/src/modules/hospitals/hospitals.service.ts
// Hospital management and dashboard analytics service

import { Injectable, NotFoundException } from '@nestjs/common';
import { EncounterStatus } from '@prisma/client';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HospitalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async getHospital(id: number, correlationId?: string) {
    await this.loggingService.debug('Fetching hospital details', {
      service: 'HospitalsService',
      operation: 'getHospital',
      correlationId,
      hospitalId: id,
    });

    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            encounters: true,
            users: true,
          },
        },
      },
    });

    if (!hospital) {
      await this.loggingService.warn('Hospital not found', {
        service: 'HospitalsService',
        operation: 'getHospital',
        correlationId,
        hospitalId: id,
      });
      throw new NotFoundException(`Hospital ${id} not found`);
    }

    await this.loggingService.debug('Hospital details fetched', {
      service: 'HospitalsService',
      operation: 'getHospital',
      correlationId,
      hospitalId: id,
    }, {
      encounterCount: hospital._count.encounters,
      userCount: hospital._count.users,
    });

    return hospital;
  }

  async getDashboard(hospitalId: number, correlationId?: string) {
    await this.loggingService.info('Fetching hospital dashboard', {
      service: 'HospitalsService',
      operation: 'getDashboard',
      correlationId,
      hospitalId,
    });
    // Get encounter counts by status
    const statusCounts = await this.prisma.encounter.groupBy({
      by: ['status'],
      where: { hospitalId },
      _count: true,
    });

    // Get active encounters (not COMPLETE, UNRESOLVED, or CANCELLED)
    const activeEncounters = await this.prisma.encounter.count({
      where: {
        hospitalId,
        status: {
          notIn: [EncounterStatus.COMPLETE, EncounterStatus.UNRESOLVED, EncounterStatus.CANCELLED],
        },
      },
    });

    // Get triage queue (TRIAGE status)
    const triageQueue = await this.prisma.encounter.count({
      where: {
        hospitalId,
        status: EncounterStatus.TRIAGE,
      },
    });

    // Get waiting room (WAITING status)
    const waitingRoom = await this.prisma.encounter.count({
      where: {
        hospitalId,
        status: EncounterStatus.WAITING,
      },
    });

    // Get recent encounters (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentEncounters = await this.prisma.encounter.count({
      where: {
        hospitalId,
        createdAt: {
          gte: oneDayAgo,
        },
      },
    });

    const dashboard = {
      hospitalId,
      activeEncounters,
      triageQueue,
      waitingRoom,
      recentEncounters,
      statusCounts: statusCounts.reduce((acc, { status, _count }) => {
        acc[status] = _count;
        return acc;
      }, {} as Record<string, number>),
    };

    await this.loggingService.info('Hospital dashboard fetched', {
      service: 'HospitalsService',
      operation: 'getDashboard',
      correlationId,
      hospitalId,
    }, {
      activeEncounters,
      triageQueue,
      waitingRoom,
      recentEncounters,
    });

    return dashboard;
  }

  async getQueueStatus(hospitalId: number, correlationId?: string) {
    await this.loggingService.info('Fetching hospital queue status', {
      service: 'HospitalsService',
      operation: 'getQueueStatus',
      correlationId,
      hospitalId,
    });
    // Get all active encounters with patient info
    const encounters = await this.prisma.encounter.findMany({
      where: {
        hospitalId,
        status: {
          notIn: [EncounterStatus.COMPLETE, EncounterStatus.UNRESOLVED, EncounterStatus.CANCELLED],
        },
      },
      select: {
        id: true,
        status: true,
        currentPriorityScore: true,
        currentCtasLevel: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            age: true,
          },
        },
        triageAssessments: {
          select: {
            ctasLevel: true,
            priorityScore: true,
            note: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { currentPriorityScore: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    const queue = {
      hospitalId,
      queueLength: encounters.length,
      encounters,
    };

    await this.loggingService.info('Hospital queue status fetched', {
      service: 'HospitalsService',
      operation: 'getQueueStatus',
      correlationId,
      hospitalId,
    }, {
      queueLength: encounters.length,
    });

    return queue;
  }
}
