// backend/src/modules/auth/guards/patient.guard.ts
// Patient authentication guard.
// Validates the cookie-backed patient session token against PatientSession.
// Legacy headers/raw records are development-only migration aids.
// Attaches { patientId, sessionId, encounterId, hospitalId } to request.patientUser.

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { EncounterStatus } from '@prisma/client';

import { PATIENT_SESSION_COOKIE, readCookie } from '../../../common/http/auth-cookie.util';
import { hashPatientSessionToken } from '../../patient-auth/patient-session-token.util';
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
    const cookieToken = readCookie(request.headers?.cookie, PATIENT_SESSION_COOKIE);
    const headerToken = request.headers['x-patient-token'] as string | undefined;
    const allowHeaderToken = (process.env.NODE_ENV || '').trim().toLowerCase() !== 'production'
      || ['1', 'true', 'yes', 'on'].includes((process.env.ALLOW_PATIENT_TOKEN_HEADER || '').trim().toLowerCase());
    const token = cookieToken ?? (allowHeaderToken ? headerToken : undefined) ?? null;

    if (!token) {
      throw new UnauthorizedException('Patient token is required');
    }

    const tokenHash = hashPatientSessionToken(token);
    let session = await this.prisma.patientSession.findUnique({
      where: { token: tokenHash },
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

    const allowLegacyRawToken = (process.env.NODE_ENV || '').trim().toLowerCase() !== 'production'
      && ['1', 'true', 'yes', 'on'].includes(
        (process.env.ALLOW_LEGACY_RAW_PATIENT_TOKENS || 'true').trim().toLowerCase(),
      );
    if (!session && allowLegacyRawToken) {
      session = await this.prisma.patientSession.findUnique({
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

      if (session) {
        await this.prisma.patientSession.update({
          where: { id: session.id },
          data: { token: tokenHash },
        }).catch(() => {
          // A parallel request may already have migrated this legacy session.
        });
      }
    }

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
