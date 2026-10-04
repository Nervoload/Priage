// Patient-facing hospital directory service.

import { Injectable } from '@nestjs/common';

import { normalizeHospitalConfig, type HospitalCustomIntakeQuestion } from '../hospitals/hospital-config';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicPilotService } from '../clinic/clinic-pilot.service';
import { ClinicEntryService } from '../clinic/clinic-entry.service';

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
  workflowProfile: 'ED' | 'CLINIC_APPOINTMENT';
  entryPath: string | null;
  appointmentBookingAvailable: boolean;
  acceptsWalkIns: boolean;
};

@Injectable()
export class PriageService {
  constructor(private readonly prisma: PrismaService, private readonly pilot: ClinicPilotService, private readonly entry: ClinicEntryService) {}

  /**
   * List available hospitals for patient to choose.
   */
  async listHospitals() {
    const hospitals = await this.prisma.hospital.findMany({
      where: this.pilot.hospitalId ? { id: this.pilot.hospitalId } : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        config: {
          select: {
            config: true,
          },
        },
        clinicEntrySettings: true,
      },
      orderBy: { name: 'asc' },
    });

    const visible = hospitals.filter((hospital) => {
      if (this.pilot.hospitalId) return hospital.id === this.pilot.hospitalId;
      if (normalizeHospitalConfig(hospital.config?.config).workflowProfile === 'ED') return true;
      return this.pilot.previewEnabled && this.pilot.previewTenantIds.has(hospital.id) && !!hospital.clinicEntrySettings?.directoryListed;
    });
    return Promise.all(visible.map(async (hospital) => {
      const profile = normalizeHospitalConfig(hospital.config?.config).workflowProfile;
      const result = this.toPatientFacingHospital(hospital);
      if (profile === 'ED') return result;
      const settings = hospital.clinicEntrySettings ?? await this.entry.settings(hospital.id);
      const metadata = this.pilot.previewEnabled ? await this.entry.resolve(settings.canonicalAlias) : null;
      return { ...result, workflowProfile: profile, entryPath: `/${settings.canonicalAlias}/start`,
        appointmentBookingAvailable: metadata?.appointmentBookingAvailable ?? false, acceptsWalkIns: settings.acceptsWalkIns };
    }));
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
      workflowProfile: normalizedConfig.workflowProfile,
      entryPath: null,
      appointmentBookingAvailable: false,
      acceptsWalkIns: false,
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
