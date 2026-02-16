// backend/src/modules/intake/intake.service.ts
// Patient intake service.

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EncounterStatus, EventType } from '@prisma/client';
import Redis from 'ioredis';

import { EventsService } from '../events/events.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { ConfirmIntentDto } from './dto/confirm-intent.dto';
import { CreateIntentDto } from './dto/create-intent.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { UpdateIntakeDetailsDto } from './dto/update-intake-details.dto';

const LOCATION_TTL_SECONDS = 600; // 10 minutes

export type LocationEntry = {
  latitude: number;
  longitude: number;
  timestamp: string;
};

@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly loggingService: LoggingService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async createIntent(dto: CreateIntentDto, correlationId?: string) {
    this.loggingService.info('Creating patient intent', {
      service: 'IntakeService',
      operation: 'createIntent',
      correlationId,
    }, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      age: dto.age,
      chiefComplaint: dto.chiefComplaint,
    });

    const token = randomUUID();

    const patient = await this.prisma.patientProfile.create({
      data: {
        email: `${randomUUID()}@intake.local`,
        password: randomUUID(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        age: dto.age,
        preferredLanguage: dto.preferredLanguage ?? 'en',
      },
    });

    await this.prisma.patientSession.create({
      data: {
        token,
        patientId: patient.id,
        pendingChiefComplaint: dto.chiefComplaint,
        pendingDetails: dto.details,
      },
    });

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

  private async confirmWithSession(
    session: { id: number; patientId: number; encounterId: number | null; pendingChiefComplaint: string | null; pendingDetails: string | null },
    dto: ConfirmIntentDto,
    correlationId?: string,
  ) {

    const hospitalId = await this.resolveHospitalId(dto);

    if (session.encounterId) {
      const existingEncounter = await this.prisma.encounter.findUnique({
        where: { id: session.encounterId },
      });

      if (!existingEncounter) {
        throw new NotFoundException('Encounter linked to session was not found');
      }
      if (existingEncounter.hospitalId !== hospitalId) {
        throw new BadRequestException(
          `Session is already confirmed for hospital ${existingEncounter.hospitalId}`,
        );
      }

      return existingEncounter;
    }

    const { encounter, event } = await this.prisma.$transaction(async (tx) => {
      const createdEncounter = await tx.encounter.create({
        data: {
          patientId: session.patientId,
          hospitalId,
          status: EncounterStatus.EXPECTED,
          chiefComplaint: session.pendingChiefComplaint,
          details: session.pendingDetails,
          expectedAt: new Date(),
        },
      });

      await tx.patientSession.update({
        where: { id: session.id },
        data: {
          encounterId: createdEncounter.id,
          pendingChiefComplaint: null,
          pendingDetails: null,
        },
      });

      const createdEvent = await this.events.emitEncounterEventTx(tx, {
        encounterId: createdEncounter.id,
        hospitalId: createdEncounter.hospitalId,
        type: EventType.ENCOUNTER_CREATED,
        metadata: {
          status: createdEncounter.status,
          intake: 'confirmed',
        },
        actor: { actorPatientId: session.patientId },
      });

      return { encounter: createdEncounter, event: createdEvent };
    });

    void this.events.dispatchEncounterEventAndMarkProcessed(event);

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
      encounterCreated: !!session.encounterId,
    });

    let encounter = null;
    if (session.encounterId) {
      encounter = await this.prisma.encounter.update({
        where: { id: session.encounterId },
        data: {
          chiefComplaint: dto.chiefComplaint,
          details: dto.details,
        },
      });
    } else {
      await this.prisma.patientSession.update({
        where: { id: session.id },
        data: {
          pendingChiefComplaint: dto.chiefComplaint,
          pendingDetails: dto.details,
        },
      });
    }

    await this.prisma.patientProfile.update({
      where: { id: session.patientId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        age: dto.age,
        allergies: dto.allergies,
        conditions: dto.conditions,
      },
    });

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
    const session = await this.prisma.patientSession.findUnique({
      where: { token: sessionToken },
    });

    if (!session) {
      this.loggingService.warn('Invalid patient session token', {
        service: 'IntakeService',
        operation: 'getSession',
        correlationId,
      });
      throw new NotFoundException('Invalid patient session token');
    }

    return session;
  }

  private async getSessionById(sessionId: number, correlationId?: string) {
    const session = await this.prisma.patientSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      this.loggingService.warn('Patient session not found by ID', {
        service: 'IntakeService',
        operation: 'getSessionById',
        correlationId,
      });
      throw new NotFoundException('Patient session not found');
    }

    return session;
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
}
