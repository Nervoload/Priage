// Patient-facing hospital directory service.

import { Injectable } from '@nestjs/common';

import { normalizeHospitalConfig, type HospitalCustomIntakeQuestion } from '../hospitals/hospital-config';
import { PrismaService } from '../prisma/prisma.service';

type PatientFacingHospitalDirectory = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  checkInInstructions: string | null;
  parkingNotes: string | null;
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  customIntakeQuestions: HospitalCustomIntakeQuestion[];
};

@Injectable()
export class PriageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List available hospitals for patient to choose.
   */
  async listHospitals() {
    const hospitals = await this.prisma.hospital.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        config: {
          select: {
            config: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return hospitals.map((hospital) => this.toPatientFacingHospital(hospital));
  }

  private toPatientFacingHospital(hospital: {
    id: number;
    name: string;
    slug: string;
    config: {
      config: unknown;
    } | null;
  }): PatientFacingHospitalDirectory {
    const rawConfig = this.asRecord(hospital.config?.config);
    const patientExperience =
      this.asRecord(rawConfig?.patientExperience)
      ?? this.asRecord(rawConfig?.patientFacing)
      ?? {};
    const coordinates =
      this.asRecord(patientExperience.coordinates)
      ?? this.asRecord(patientExperience.location)
      ?? null;

    const latitude = this.asNumber(coordinates?.latitude);
    const longitude = this.asNumber(coordinates?.longitude);
    const normalizedConfig = normalizeHospitalConfig(hospital.config?.config);

    return {
      id: hospital.id,
      name: hospital.name,
      slug: hospital.slug,
      address: this.asString(patientExperience.address),
      phone: this.asString(patientExperience.phone),
      checkInInstructions:
        this.asString(patientExperience.checkInInstructions)
        ?? this.asString(patientExperience.entranceNotes),
      parkingNotes: this.asString(patientExperience.parkingNotes),
      coordinates:
        latitude !== null && longitude !== null
          ? {
              latitude,
              longitude,
            }
          : null,
      customIntakeQuestions: normalizedConfig.customIntakeQuestions.filter(
        (question) => question.appliesTo !== 'triage',
      ),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

}
