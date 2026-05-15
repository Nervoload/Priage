// backend/src/modules/auth/guards/patient.guard.ts
// Patient authentication guard.
// Validates the cookie-backed patient session token (or legacy x-patient-token
// header) against PatientSession in the database.
// Attaches { patientId, sessionId, encounterId, hospitalId } to request.patientUser.

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { EncounterStatus } from '@prisma/client';

import { PATIENT_SESSION_COOKIE, readCookie } from '../../../common/http/auth-cookie.util';
import { PrismaService } from '../../prisma/prisma.service';

export interface PatientContext {
  patientId: number;
  sessionId: number;
  encounterId: number | null;
  hospitalId: number | null;
}

const TERMINAL_SESSION_ENCOUNTER_STATUSES = new Set<EncounterStatus>([
  EncounterStatus.COMPLETE,
  EncounterStatus.CANCELLED,
  EncounterStatus.UNRESOLVED,
]);

@Injectable()
export class PatientGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = readCookie(request.headers?.cookie, PATIENT_SESSION_COOKIE)
      ?? (request.headers['x-patient-token'] as string | undefined)
      ?? null;

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
          select: {
            hospitalId: true,
            status: true,
          },
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

    // Patient account sessions remain valid after a visit ends. We only surface
    // encounter-scoped context while the linked encounter is still active.
    const hasActiveEncounter =
      session.encounterId !== null
      && session.encounter !== null
      && !TERMINAL_SESSION_ENCOUNTER_STATUSES.has(session.encounter.status);
    const activeEncounterHospitalId = hasActiveEncounter && session.encounter
      ? session.encounter.hospitalId
      : null;

    const patientUser: PatientContext = {
      patientId: session.patientId,
      sessionId: session.id,
      encounterId: hasActiveEncounter ? session.encounterId : null,
      hospitalId: activeEncounterHospitalId,
    };

    request.patientUser = patientUser;
    return true;
  }
}
