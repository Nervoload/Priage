import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { normalizeHospitalConfig } from '../hospitals/hospital-config';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicPilotService } from './clinic-pilot.service';
import { readAssessmentConfig } from '../assessment/assessment-config';

const ALIAS = /^[a-z0-9][a-z0-9_-]{2,47}$/;
const RESERVED = new Set([
  'account', 'admin', 'api', 'auth', 'clinic', 'clinic-intake', 'dashboard', 'demo-access',
  'encounters', 'enroute', 'guest', 'health', 'intake', 'login', 'messages', 'patient',
  'platform', 'priage', 'privacy', 'settings', 'signup', 'terms', 'visits', 'walk-in', 'welcome',
]);

export type ClinicEntryUpdate = { canonicalAlias: string; directoryListed: boolean; acceptsWalkIns: boolean };

@Injectable()
export class ClinicEntryService {
  constructor(private readonly prisma: PrismaService, private readonly pilot: ClinicPilotService) {}

  private async assertClinic(hospitalId: number) {
    const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId },
      select: { id: true, name: true, config: { select: { config: true } } } });
    if (!hospital || normalizeHospitalConfig(hospital.config?.config).workflowProfile !== 'CLINIC_APPOINTMENT') throw new NotFoundException();
    return hospital;
  }

  async settings(hospitalId: number) {
    await this.assertClinic(hospitalId);
    let row = await this.prisma.clinicEntrySettings.findUnique({ where: { hospitalId } });
    if (!row) {
      try {
        row = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.clinicEntrySettings.findUnique({ where: { hospitalId } });
          if (existing) return existing;
          const alias = `clinic-${hospitalId}`;
          const created = await tx.clinicEntrySettings.create({ data: { hospitalId, canonicalAlias: alias } });
          await tx.clinicEntryAlias.create({ data: { alias, hospitalId } });
          return created;
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
        row = await this.prisma.clinicEntrySettings.findUniqueOrThrow({ where: { hospitalId } });
      }
    }
    return { ...row, startPath: `/${row.canonicalAlias}/start`, walkInPath: `/${row.canonicalAlias}/walk-in` };
  }

  async update(hospitalId: number, value: ClinicEntryUpdate) {
    await this.assertClinic(hospitalId);
    const alias = value.canonicalAlias.trim().toLowerCase();
    if (!ALIAS.test(alias) || RESERVED.has(alias)) throw new BadRequestException('Use a unique 3–48 character clinic path with letters, numbers, _ or -');
    await this.settings(hospitalId);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT "hospitalId" FROM "ClinicEntrySettings" WHERE "hospitalId" = ${hospitalId} FOR UPDATE`;
        const assigned = await tx.clinicEntryAlias.findUnique({ where: { alias } });
        if (assigned && assigned.hospitalId !== hospitalId) throw new ConflictException('This clinic link is already in use');
        if (!assigned) await tx.clinicEntryAlias.create({ data: { alias, hospitalId } });
        await tx.clinicEntrySettings.update({ where: { hospitalId }, data: {
          canonicalAlias: alias, directoryListed: value.directoryListed, acceptsWalkIns: value.acceptsWalkIns,
        } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('This clinic link is already in use');
      throw error;
    }
    return this.settings(hospitalId);
  }

  async resolve(alias: string) {
    const normalized = alias.trim().toLowerCase();
    if (!ALIAS.test(normalized)) throw new NotFoundException();
    const record = await this.prisma.clinicEntryAlias.findUnique({ where: { alias: normalized },
      include: { hospital: { select: { id: true, name: true, slug: true, config: { select: { config: true } }, clinicEntrySettings: true } } } });
    if (!record || normalizeHospitalConfig(record.hospital.config?.config).workflowProfile !== 'CLINIC_APPOINTMENT') throw new NotFoundException();
    this.pilot.assertTenantEnabled(record.hospitalId);
    const settings = record.hospital.clinicEntrySettings;
    if (!settings) throw new NotFoundException();
    const [schedule, terms, privacy] = await Promise.all([
      this.prisma.clinicSchedule.findUnique({ where: { hospitalId: record.hospitalId }, select: { hospitalId: true } }),
      this.prisma.legalDocumentVersion.findFirst({ where: { kind: 'TERMS', publishedAt: { lte: new Date() } }, select: { id: true } }),
      this.prisma.legalDocumentVersion.findFirst({ where: { kind: 'PRIVACY', publishedAt: { lte: new Date() } }, select: { id: true } }),
    ]);
    return { id: record.hospitalId, name: record.hospital.name, slug: record.hospital.slug,
      workflowProfile: 'CLINIC_APPOINTMENT' as const,
      directoryListed: settings.directoryListed, acceptsWalkIns: settings.acceptsWalkIns,
      alias: settings.canonicalAlias, requestedAlias: normalized,
      startPath: `/${settings.canonicalAlias}/start`, walkInPath: `/${settings.canonicalAlias}/walk-in`,
      appointmentBookingAvailable: !!schedule && !!terms && !!privacy,
      preview: true, assessmentEngine: readAssessmentConfig().engine === 'harness' ? 'assessment_harness' as const : 'deterministic_preview' as const,
    };
  }

  async assertWalkIns(hospitalId: number) {
    this.pilot.assertTenantEnabled(hospitalId);
    const settings = await this.settings(hospitalId);
    if (!settings.acceptsWalkIns) throw new ConflictException('This clinic accepts appointments only');
  }
}
