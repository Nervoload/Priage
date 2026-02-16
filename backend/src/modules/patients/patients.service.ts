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

  // Phase 6.3: Add a findAll / searchPatients method here for server-side filtering:
  //   async searchPatients(hospitalId: number, search?: string, status?: string, page = 1, limit = 20)
  // Use Prisma WHERE with `contains` on firstName/lastName/phone, join through
  // encounters to filter by status, and return paginated results with total count.
  // This avoids loading all patients client-side as the dataset grows.

  async getPatient(patientId: number, hospitalId: number, correlationId?: string) {
    this.loggingService.debug('Fetching patient profile', {
      service: 'PatientsService',
      operation: 'getPatient',
      correlationId,
      patientId,
      hospitalId,
    });

    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
      include: {
        // Only return encounters that belong to the requesting hospital
        encounters: {
          where: { hospitalId },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!patient) {
      this.loggingService.warn('Patient not found', {
        service: 'PatientsService',
        operation: 'getPatient',
        correlationId,
        patientId,
      });
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    // Verify the patient has at least one encounter at this hospital
    // (prevents fishing for patient IDs across hospitals)
    if (patient.encounters.length === 0) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    this.loggingService.debug('Patient profile fetched successfully', {
      service: 'PatientsService',
      operation: 'getPatient',
      correlationId,
      patientId,
      hospitalId,
    }, {
      encounterCount: patient.encounters.length,
    });

    return patient;
  }
}
