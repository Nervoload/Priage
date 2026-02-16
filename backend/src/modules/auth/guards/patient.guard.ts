// backend/src/modules/auth/guards/patient.guard.ts
// Patient authentication guard.
// Validates the x-patient-token header against PatientSession in the database.
// Attaches { patientId, sessionId, encounterId, hospitalId } to request.patientUser.

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PatientContext {
  patientId: number;
  sessionId: number;
  encounterId: number | null;
  hospitalId: number | null;
}

@Injectable()
export class PatientGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-patient-token'] as string;

    if (!token) {
      throw new UnauthorizedException('Patient token is required');
    }

    const session = await this.prisma.patientSession.findUnique({
      where: { token },
      select: {
        id: true,
        patientId: true,
        encounterId: true,
        expiresAt: true,
        encounter: {
          select: { hospitalId: true },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid patient session token');
    }

    // Check expiry if set
    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new UnauthorizedException('Patient session has expired');
    }

    const patientUser: PatientContext = {
      patientId: session.patientId,
      sessionId: session.id,
      encounterId: session.encounterId,
      hospitalId: session.encounter?.hospitalId ?? null,
    };

    request.patientUser = patientUser;
    return true;
  }
}
