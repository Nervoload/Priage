// backend/src/modules/patients/patients.service.ts
// Patient profile service.

import { Injectable, NotFoundException } from '@nestjs/common';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async getPatient(patientId: number, correlationId?: string) {
    await this.loggingService.debug('Fetching patient profile', {
      service: 'PatientsService',
      operation: 'getPatient',
      correlationId,
      patientId,
    });

    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
      include: {
        encounters: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!patient) {
      await this.loggingService.warn('Patient not found', {
        service: 'PatientsService',
        operation: 'getPatient',
        correlationId,
        patientId,
      });
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    await this.loggingService.debug('Patient profile fetched successfully', {
      service: 'PatientsService',
      operation: 'getPatient',
      correlationId,
      patientId,
    }, {
      encounterCount: patient.encounters.length,
    });

    return patient;
  }
}
