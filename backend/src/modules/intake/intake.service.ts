// backend/src/modules/intake/intake.service.ts
// Patient intake service.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EncounterStatus, EventType } from '@prisma/client';

import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmIntentDto } from './dto/confirm-intent.dto';
import { CreateIntentDto } from './dto/create-intent.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { UpdateIntakeDetailsDto } from './dto/update-intake-details.dto';

const LOCATION_TTL_MS = 10 * 60 * 1000;

type LocationEntry = {
  latitude: number;
  longitude: number;
  timestamp: Date;
};

@Injectable()
export class IntakeService {
  private readonly locationCache = new Map<number, LocationEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async createIntent(dto: CreateIntentDto) {
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

    const encounter = await this.prisma.encounter.create({
      data: {
        patientId: patient.id,
        status: EncounterStatus.EXPECTED,
        chiefComplaint: dto.chiefComplaint,
        details: dto.details,
      },
    });

    await this.prisma.patientSession.create({
      data: {
        token,
        patientId: patient.id,
        encounterId: encounter.id,
      },
    });

    return {
      sessionToken: token,
      encounterId: encounter.id,
      patientId: patient.id,
    };
  }

  async confirmIntent(sessionToken: string, dto: ConfirmIntentDto) {
    const session = await this.getSession(sessionToken);

    const hospitalId = await this.resolveHospitalId(dto);

    const { encounter, event } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.encounter.update({
        where: { id: session.encounterId },
        data: {
          hospitalId,
          expectedAt: new Date(),
        },
      });

      const createdEvent = await this.events.emitEncounterEventTx(tx, {
        encounterId: updated.id,
        hospitalId: updated.hospitalId ?? undefined,
        type: EventType.ENCOUNTER_CREATED,
        metadata: {
          status: updated.status,
          intake: 'confirmed',
        },
        actor: { actorPatientId: session.patientId },
      });

      return { encounter: updated, event: createdEvent };
    });

    if (event) {
      this.events.dispatchEncounterEvent(event);
    }

    return encounter;
  }

  async updateDetails(sessionToken: string, dto: UpdateIntakeDetailsDto) {
    const session = await this.getSession(sessionToken);

    const encounter = await this.prisma.encounter.update({
      where: { id: session.encounterId },
      data: {
        chiefComplaint: dto.chiefComplaint,
        details: dto.details,
      },
    });

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

    return encounter;
  }

  async recordLocation(sessionToken: string, dto: LocationPingDto) {
    const session = await this.getSession(sessionToken);

    this.locationCache.set(session.encounterId, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      timestamp: new Date(),
    });

    setTimeout(() => {
      const entry = this.locationCache.get(session.encounterId);
      if (entry && Date.now() - entry.timestamp.getTime() >= LOCATION_TTL_MS) {
        this.locationCache.delete(session.encounterId);
      }
    }, LOCATION_TTL_MS);

    return { ok: true };
  }

  private async getSession(sessionToken: string) {
    const session = await this.prisma.patientSession.findUnique({
      where: { token: sessionToken },
    });

    if (!session) {
      throw new NotFoundException('Invalid patient session token');
    }

    return session;
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
