// backend/src/modules/patients/patients.service.ts
// Patient profile service.

import { Injectable, NotFoundException } from '@nestjs/common';
import { EncounterStatus } from '@prisma/client';

import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListPatientsQueryDto } from './dto/list-patients.query.dto';

type PatientListItem = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  age: number | null;
  gender: string | null;
  preferredLanguage: string | null;
  latestEncounter: {
    id: number;
    status: EncounterStatus;
    chiefComplaint: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async listPatients(
    hospitalId: number,
    query: ListPatientsQueryDto,
    correlationId?: string,
  ): Promise<PaginatedResponse<PatientListItem>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    this.loggingService.debug('Listing patients', {
      service: 'PatientsService',
      operation: 'listPatients',
      correlationId,
      hospitalId,
    }, {
      page,
      limit,
      status: query.status,
    });

    const where = {
      encounters: {
        some: {
          hospitalId,
          ...(query.status ? { status: query.status } : {}),
        },
      },
    };

    try {
      const [patients, total] = await Promise.all([
        this.prisma.patientProfile.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            age: true,
            gender: true,
            preferredLanguage: true,
            encounters: {
              where: { hospitalId },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                status: true,
                chiefComplaint: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          orderBy: [
            { lastName: 'asc' },
            { firstName: 'asc' },
            { id: 'asc' },
          ],
          skip,
          take: limit,
        }),
        this.prisma.patientProfile.count({ where }),
      ]);

      const data: PatientListItem[] = patients.map((patient) => ({
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        phone: patient.phone,
        age: patient.age,
        gender: patient.gender,
        preferredLanguage: patient.preferredLanguage,
        latestEncounter: patient.encounters[0] ?? null,
      }));

      const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

      this.loggingService.debug('Patients listed successfully', {
        service: 'PatientsService',
        operation: 'listPatients',
        correlationId,
        hospitalId,
      }, {
        count: data.length,
        total,
        page,
        limit,
        totalPages,
        status: query.status,
      });

      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1 && totalPages > 0,
        },
      };
    } catch (error) {
      await this.loggingService.error('Failed to list patients', {
        service: 'PatientsService',
        operation: 'listPatients',
        correlationId,
        hospitalId,
      }, error instanceof Error ? error : new Error(String(error)), {
        page,
        limit,
        status: query.status,
      });
      throw error;
    }
  }

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
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        age: true,
        gender: true,
        heightCm: true,
        weightKg: true,
        allergies: true,
        conditions: true,
        preferredLanguage: true,
        optionalHealthInfo: true,
        createdAt: true,
        encounters: {
          where: { hospitalId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            chiefComplaint: true,
            createdAt: true,
            expectedAt: true,
            arrivedAt: true,
            triagedAt: true,
            waitingAt: true,
            departedAt: true,
            cancelledAt: true,
          },
        },
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
