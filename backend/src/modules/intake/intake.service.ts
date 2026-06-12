// backend/src/modules/intake/intake.service.ts
// Patient intake service.

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ContextSourceType, EncounterStatus, Prisma, ReviewState, TrustTier, VisibilityScope } from '@prisma/client';
import Redis from 'ioredis';

import { PATIENT_SESSION_TTL_MS } from '../../common/http/auth-cookie.util';
import { normalizeHospitalConfig, type HospitalIntakeResponseType } from '../hospitals/hospital-config';
import { IntakeSessionsService } from '../intake-sessions/intake-sessions.service';
import { LoggingService } from '../logging/logging.service';
import { buildGuestPlaceholderPasswordHash } from '../patient-auth/patient-password.util';
import { generatePatientSessionToken, hashPatientSessionToken } from '../patient-auth/patient-session-token.util';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { ConfirmIntentDto } from './dto/confirm-intent.dto';
import { CreateIntentDto } from './dto/create-intent.dto';
import { AdvanceInterviewDto } from './dto/interview.dto';
import { TriageInterviewService } from './interview/triage-interview.service';
import { LocationPingDto } from './dto/location-ping.dto';
import { UpdateIntakeDetailsDto } from './dto/update-intake-details.dto';

const LOCATION_TTL_SECONDS = 600; // 10 minutes
const TERMINAL_SESSION_ENCOUNTER_STATUSES = new Set<EncounterStatus>([
  EncounterStatus.COMPLETE,
  EncounterStatus.CANCELLED,
  EncounterStatus.UNRESOLVED,
]);

export type LocationEntry = {
  latitude: number;
  longitude: number;
  timestamp: string;
};

type SessionRecord = {
  id: number;
  patientId: number;
  encounterId: number | null;
  expiresAt: Date | null;
  encounter: {
    hospitalId: number;
    status: EncounterStatus;
  } | null;
};

@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intakeSessions: IntakeSessionsService,
    private readonly loggingService: LoggingService,
    private readonly triageInterview: TriageInterviewService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async createIntent(dto: CreateIntentDto, correlationId?: string) {
    this.loggingService.info('Creating patient intent', {
      service: 'IntakeService',
      operation: 'createIntent',
      correlationId,
    }, {
      hasFirstName: !!dto.firstName,
      hasLastName: !!dto.lastName,
      hasPhone: !!dto.phone,
      hasAge: dto.age !== undefined && dto.age !== null,
      hasGender: !!dto.gender,
      hasChiefComplaint: !!dto.chiefComplaint,
      hasDetails: !!dto.details,
    });

    const token = generatePatientSessionToken();
    const placeholderPasswordHash = await buildGuestPlaceholderPasswordHash();

    const patient = await this.prisma.patientProfile.create({
      data: {
        email: `${randomUUID()}@intake.local`,
        password: placeholderPasswordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        age: dto.age,
        gender: dto.gender,
        preferredLanguage: dto.preferredLanguage ?? 'en',
      },
    });

    const authSession = await this.prisma.patientSession.create({
      data: {
        token: hashPatientSessionToken(token),
        patientId: patient.id,
        expiresAt: new Date(Date.now() + PATIENT_SESSION_TTL_MS),
      },
    });

    await this.intakeSessions.createDraft(
      {
        patientId: patient.id,
        authSessionId: authSession.id,
      },
      correlationId,
    );

    if (dto.chiefComplaint || dto.details || dto.firstName || dto.lastName || dto.phone || dto.age || dto.gender || dto.preferredLanguage) {
      await this.intakeSessions.appendContextItemByAuthSession(
        authSession.id,
        patient.id,
        {
          itemType: 'patient_intake',
          schemaVersion: 'v1',
          payload: {
            chiefComplaint: dto.chiefComplaint,
            details: dto.details,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            age: dto.age,
            gender: dto.gender,
            preferredLanguage: dto.preferredLanguage,
          },
          sourceType: ContextSourceType.PATIENT,
          trustTier: TrustTier.UNTRUSTED,
          reviewState: ReviewState.UNREVIEWED,
          visibilityScope: VisibilityScope.STORED_ONLY,
          patientId: patient.id,
        },
        correlationId,
      );
    }

    this.loggingService.info('Patient intent created successfully', {
      service: 'IntakeService',
      operation: 'createIntent',
      correlationId,
      patientId: patient.id,
    }, {
      sessionTokenGenerated: true,
      encounterCreated: false,
    });

    return {
      sessionToken: token,
      patientId: patient.id,
      encounterId: null,
    };
  }

  async confirmIntent(sessionToken: string, dto: ConfirmIntentDto, correlationId?: string) {
    const session = await this.getSession(sessionToken, correlationId);
    return this.confirmWithSession(session, dto, correlationId);
  }

  /**
   * Confirm intent using a pre-validated session ID (from PatientGuard).
   */
  async confirmIntentBySession(sessionId: number, dto: ConfirmIntentDto, correlationId?: string) {
    const session = await this.getSessionById(sessionId, correlationId);
    return this.confirmWithSession(session, dto, correlationId);
  }

  async startInterviewBySession(sessionId: number, patientId: number, correlationId?: string) {
    return this.triageInterview.startBySession(sessionId, patientId, correlationId);
  }

  async advanceInterviewBySession(
    sessionId: number,
    patientId: number,
    dto: AdvanceInterviewDto,
    correlationId?: string,
  ) {
    return this.triageInterview.advanceBySession(sessionId, patientId, dto, correlationId);
  }

  private async confirmWithSession(
    session: SessionRecord,
    dto: ConfirmIntentDto,
    correlationId?: string,
  ) {
    await this.triageInterview.ensureInterviewCompleteBySession(session.id, session.patientId, correlationId);
    const hospitalId = await this.resolveHospitalId(dto);
    const encounter = await this.intakeSessions.confirmByAuthSession(
      session.id,
      session.patientId,
      {
        hospitalId,
        sourceLabel: 'patient_intake',
      },
      correlationId,
    );

    this.loggingService.info('Patient intent confirmed successfully', {
      service: 'IntakeService',
      operation: 'confirmIntent',
      correlationId,
      patientId: session.patientId,
      encounterId: encounter.id,
      hospitalId: encounter.hospitalId,
    }, {
      encounterStatus: encounter.status,
      eventDispatched: true,
    });

    return encounter;
  }

  async updateDetails(sessionToken: string, dto: UpdateIntakeDetailsDto, correlationId?: string) {
    const session = await this.getSession(sessionToken, correlationId);
    return this.updateDetailsWithSession(session, dto, correlationId);
  }

  /**
   * Update details using a pre-validated session ID (from PatientGuard).
   */
  async updateDetailsBySession(sessionId: number, dto: UpdateIntakeDetailsDto, correlationId?: string) {
    const session = await this.getSessionById(sessionId, correlationId);
    return this.updateDetailsWithSession(session, dto, correlationId);
  }

  private async updateDetailsWithSession(
    session: { id: number; patientId: number; encounterId: number | null },
    dto: UpdateIntakeDetailsDto,
    correlationId?: string,
  ) {
    this.loggingService.info('Updating patient intake details', {
      service: 'IntakeService',
      operation: 'updateDetails',
      correlationId,
      patientId: session.patientId,
      encounterId: session.encounterId ?? undefined,
    }, {
      hasChiefComplaint: !!dto.chiefComplaint,
      hasDetails: !!dto.details,
      hasAllergies: !!dto.allergies,
      hasConditions: !!dto.conditions,
      hasCustomQuestionAnswers: !!dto.customQuestionAnswers,
      encounterCreated: !!session.encounterId,
    });

    const optionalHealthInfo = await this.buildOptionalHealthInfoUpdate(session, dto.customQuestionAnswers);

    await this.intakeSessions.appendContextItemByAuthSession(
      session.id,
      session.patientId,
      {
        itemType: 'patient_intake',
        schemaVersion: 'v1',
        payload: {
          chiefComplaint: dto.chiefComplaint,
          details: dto.details,
          firstName: dto.firstName,
          lastName: dto.lastName,
          age: dto.age,
          allergies: dto.allergies,
          conditions: dto.conditions,
          customQuestionAnswers: optionalHealthInfo ?? undefined,
        },
        sourceType: ContextSourceType.PATIENT,
        trustTier: TrustTier.UNTRUSTED,
        reviewState: ReviewState.UNREVIEWED,
        visibilityScope: session.encounterId ? VisibilityScope.ADMISSIONS : VisibilityScope.STORED_ONLY,
        patientId: session.patientId,
      },
      correlationId,
    );

    if (session.encounterId && (dto.chiefComplaint !== undefined || dto.details !== undefined)) {
      await this.prisma.encounter.update({
        where: { id: session.encounterId },
        data: {
          chiefComplaint: dto.chiefComplaint !== undefined ? dto.chiefComplaint : undefined,
          details: dto.details !== undefined ? dto.details : undefined,
        },
      });
    }

    if (optionalHealthInfo !== undefined) {
      await this.prisma.patientProfile.update({
        where: { id: session.patientId },
        data: {
          optionalHealthInfo:
            Object.keys(optionalHealthInfo).length > 0
              ? (optionalHealthInfo as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
      });
    }

    const encounter = session.encounterId
      ? await this.prisma.encounter.findUnique({ where: { id: session.encounterId } })
      : null;

    this.loggingService.info('Patient intake details updated successfully', {
      service: 'IntakeService',
      operation: 'updateDetails',
      correlationId,
      patientId: session.patientId,
      encounterId: session.encounterId ?? undefined,
    });

    return encounter ?? { ok: true, pending: true };
  }

  async recordLocation(sessionToken: string, dto: LocationPingDto, correlationId?: string) {
    const session = await this.getSession(sessionToken, correlationId);
    return this.recordLocationWithSession(session, dto, correlationId);
  }

  /**
   * Record location using a pre-validated session ID (from PatientGuard).
   */
  async recordLocationBySession(sessionId: number, dto: LocationPingDto, correlationId?: string) {
    const session = await this.getSessionById(sessionId, correlationId);
    return this.recordLocationWithSession(session, dto, correlationId);
  }

  private async recordLocationWithSession(
    session: { id: number; patientId: number; encounterId: number | null },
    dto: LocationPingDto,
    correlationId?: string,
  ) {
    const cacheKey = this.getLocationCacheKey(session);

    this.loggingService.debug('Recording patient location', {
      service: 'IntakeService',
      operation: 'recordLocation',
      correlationId,
      patientId: session.patientId,
      encounterId: session.encounterId ?? undefined,
    }, {
      hasLocation: true,
      ttlSeconds: LOCATION_TTL_SECONDS,
    });

    const entry: LocationEntry = {
      latitude: dto.latitude,
      longitude: dto.longitude,
      timestamp: new Date().toISOString(),
    };

    await this.redis.set(cacheKey, JSON.stringify(entry), 'EX', LOCATION_TTL_SECONDS);

    return { ok: true };
  }

  private async getSession(sessionToken: string, correlationId?: string) {
    const session = await this.findSessionByToken(sessionToken, {
      include: {
        encounter: {
          select: {
            hospitalId: true,
            status: true,
          },
        },
      },
    });

    if (!session) {
      await this.loggingService.warn('Invalid patient session token', {
        service: 'IntakeService',
        operation: 'getSession',
        correlationId,
      });
      throw new NotFoundException('Invalid patient session token');
    }

    this.ensureSessionIsActive(session);

    return this.normalizeSession(session);
  }

  private async findSessionByToken<T extends Prisma.PatientSessionInclude>(
    sessionToken: string,
    args: { include: T },
  ) {
    const tokenHash = hashPatientSessionToken(sessionToken);
    const hashedSession = await this.prisma.patientSession.findUnique({
      where: { token: tokenHash },
      include: args.include,
    });

    if (hashedSession) {
      return hashedSession;
    }

    const allowLegacyRawToken = (process.env.NODE_ENV || '').trim().toLowerCase() !== 'production'
      && ['1', 'true', 'yes', 'on'].includes(
        (process.env.ALLOW_LEGACY_RAW_PATIENT_TOKENS || 'true').trim().toLowerCase(),
      );
    if (!allowLegacyRawToken) {
      return null;
    }

    const legacySession = await this.prisma.patientSession.findUnique({
      where: { token: sessionToken },
      include: args.include,
    });

    if (legacySession) {
      await this.prisma.patientSession.update({
        where: { id: legacySession.id },
        data: { token: tokenHash },
      }).catch(() => {
        // If a parallel request already migrated the session token, the next
        // request will resolve by hash.
      });
    }

    return legacySession;
  }

  private async getSessionById(sessionId: number, correlationId?: string) {
    const session = await this.prisma.patientSession.findUnique({
      where: { id: sessionId },
      include: {
        encounter: {
          select: {
            hospitalId: true,
            status: true,
          },
        },
      },
    });

    if (!session) {
      await this.loggingService.warn('Patient session not found by ID', {
        service: 'IntakeService',
        operation: 'getSessionById',
        correlationId,
      });
      throw new NotFoundException('Patient session not found');
    }

    this.ensureSessionIsActive(session);

    return this.normalizeSession(session);
  }

  private ensureSessionIsActive(session: {
    expiresAt: Date | null;
  }) {
    if (session.expiresAt && session.expiresAt < new Date()) {
      throw new UnauthorizedException('Patient session has expired');
    }
  }

  private normalizeSession<T extends {
    encounterId: number | null;
    encounter: { hospitalId: number; status: EncounterStatus } | null;
  }>(session: T): T {
    if (!session.encounter || !TERMINAL_SESSION_ENCOUNTER_STATUSES.has(session.encounter.status)) {
      return session;
    }

    return {
      ...session,
      encounterId: null,
      encounter: null,
    };
  }

  private getLocationCacheKey(session: { id: number; encounterId: number | null }) {
    return session.encounterId ? `location:encounter:${session.encounterId}` : `location:session:${session.id}`;
  }

  /**
   * Retrieve the latest location for a session/encounter from Redis.
   */
  async getLocation(sessionId: number): Promise<LocationEntry | null> {
    const session = await this.getSessionById(sessionId);
    const key = this.getLocationCacheKey(session);
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as LocationEntry) : null;
  }

  private async resolveHospitalId(dto: ConfirmIntentDto) {
    if (dto.hospitalId) {
      return dto.hospitalId;
    }

    if (dto.hospitalSlug) {
      const hospital = await this.prisma.hospital.findUnique({
        where: { slug: dto.hospitalSlug },
        select: { id: true },
      });
      if (!hospital) throw new NotFoundException('Hospital not found');
      return hospital.id;
    }

    throw new BadRequestException('hospitalId or hospitalSlug is required');
  }

  private async buildOptionalHealthInfoUpdate(
    session: { patientId: number; encounterId: number | null },
    rawAnswers: Record<string, unknown> | undefined,
  ): Promise<Record<string, string | number | boolean> | undefined> {
    if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers) || !session.encounterId) {
      return undefined;
    }

    const encounter = await this.prisma.encounter.findUnique({
      where: { id: session.encounterId },
      select: {
        hospital: {
          select: {
            config: {
              select: {
                config: true,
              },
            },
          },
        },
      },
    });
    if (!encounter) {
      return undefined;
    }

    const applicableQuestions = normalizeHospitalConfig(encounter.hospital.config?.config)
      .customIntakeQuestions
      .filter((question) => question.appliesTo !== 'triage');
    if (applicableQuestions.length === 0) {
      return undefined;
    }

    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: session.patientId },
      select: { optionalHealthInfo: true },
    });
    const nextHealthInfo = this.toSimpleRecord(patient?.optionalHealthInfo);

    for (const question of applicableQuestions) {
      if (!(question.fieldKey in rawAnswers)) {
        continue;
      }

      const normalized = this.normalizeCustomQuestionAnswer(
        rawAnswers[question.fieldKey],
        question.responseType,
      );

      if (normalized === undefined) {
        delete nextHealthInfo[question.fieldKey];
        continue;
      }

      nextHealthInfo[question.fieldKey] = normalized;
    }

    return nextHealthInfo;
  }

  private normalizeCustomQuestionAnswer(
    value: unknown,
    responseType: HospitalIntakeResponseType,
  ): string | number | boolean | undefined {
    if (value == null) {
      return undefined;
    }

    switch (responseType) {
      case 'boolean':
        if (typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          if (normalized === 'true' || normalized === 'yes') return true;
          if (normalized === 'false' || normalized === 'no') return false;
        }
        return undefined;
      case 'number': {
        const numeric = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(numeric) ? numeric : undefined;
      }
      case 'textarea':
      case 'text':
      case 'select':
      default: {
        if (typeof value !== 'string') {
          return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
    }
  }

  private toSimpleRecord(value: unknown): Record<string, string | number | boolean> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string | number | boolean>>(
      (accumulator, [key, entry]) => {
        if (
          typeof entry === 'string'
          || typeof entry === 'number'
          || typeof entry === 'boolean'
        ) {
          accumulator[key] = entry;
        }
        return accumulator;
      },
      {},
    );
  }
}
