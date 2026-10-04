import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';

import { normalizeHospitalConfig } from '../hospitals/hospital-config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClinicPilotService implements OnModuleInit {
  readonly hospitalId: number | null;
  readonly previewEnabled: boolean;
  readonly previewTenantIds: ReadonlySet<number>;

  constructor(private readonly prisma: PrismaService) {
    const raw = process.env.PILOT_CLINIC_ID?.trim();
    const parsed = raw ? Number(raw) : null;
    if (raw && (!Number.isInteger(parsed) || parsed! < 1)) {
      throw new Error('PILOT_CLINIC_ID must be a positive integer');
    }
    this.hospitalId = parsed;
    const tenantIds = (process.env.CLINIC_PREVIEW_TENANT_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);
    if (tenantIds.some((value) => !/^\d+$/.test(value) || Number(value) < 1)) {
      throw new Error('CLINIC_PREVIEW_TENANT_IDS must contain positive integer IDs');
    }
    this.previewTenantIds = new Set(tenantIds.map(Number));
    this.previewEnabled = ['1', 'true', 'yes', 'on'].includes(
      (process.env.CLINIC_PREVIEW_ENABLED || '').trim().toLowerCase(),
    );
    if (this.previewEnabled && !this.hospitalId && !this.previewTenantIds.size) {
      throw new Error('CLINIC_PREVIEW_ENABLED requires PILOT_CLINIC_ID or CLINIC_PREVIEW_TENANT_IDS');
    }
    if (this.previewEnabled && !['', 'deterministic'].includes((process.env.TRIAGE_INTERVIEW_MODE || '').trim().toLowerCase())) {
      throw new Error('Clinic intake preview requires deterministic interview mode');
    }
    if (this.previewEnabled && process.env.NODE_ENV === 'production' && process.env.PILOT_INTERNAL_STAGING !== 'true') {
      throw new Error('Production-built clinic preview requires PILOT_INTERNAL_STAGING=true on a network-restricted staging deployment');
    }
  }

  async onModuleInit() {
    for (const id of this.hospitalId ? [this.hospitalId] : this.previewTenantIds) {
      const hospital = await this.prisma.hospital.findUnique({
        where: { id }, select: { id: true, config: { select: { config: true } } },
      });
      if (!hospital || normalizeHospitalConfig(hospital.config?.config).workflowProfile !== 'CLINIC_APPOINTMENT') {
        throw new Error(`Clinic preview tenant ${id} must identify a CLINIC_APPOINTMENT tenant`);
      }
    }
  }

  assertPreviewEnabled(): number {
    if (!this.hospitalId || !this.previewEnabled) throw new NotFoundException();
    return this.hospitalId;
  }

  assertTenant(hospitalId: number): void {
    this.assertTenantEnabled(hospitalId);
  }

  assertTenantEnabled(hospitalId: number): number {
    if (!this.previewEnabled || (this.hospitalId ? hospitalId !== this.hospitalId : !this.previewTenantIds.has(hospitalId))) {
      throw new NotFoundException();
    }
    return hospitalId;
  }
}
