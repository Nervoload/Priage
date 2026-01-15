// backend/src/modules/patients/patients.service.ts
// Patient profile service.

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPatient(patientId: number) {
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
      include: {
        encounters: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    return patient;
  }
}
