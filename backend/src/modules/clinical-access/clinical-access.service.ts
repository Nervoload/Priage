import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

import { SensitiveReadAuditService } from '../audit/sensitive-read-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { BreakGlassDto, GrantEncounterAccessDto } from './dto/clinical-access.dto';
import { hasClinicalCapability } from './clinical-access.policy';

export type StaffClinicalContext = {
  userId: number;
  hospitalId: number;
  role: Role;
};

@Injectable()
export class ClinicalAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: SensitiveReadAuditService,
  ) {}

  canReadClinical(role: Role): boolean {
    return hasClinicalCapability(role, 'encounter.detail.clinical');
  }

  async getClinicalEncounterScope(
    context: StaffClinicalContext,
  ): Promise<number[] | null> {
    if (!this.canReadClinical(context.role)) return [];
    if (!this.careTeamEnforcementEnabled()) {
      return null;
    }

    const now = new Date();
    const [assigned, breakGlass] = await Promise.all([
      this.prisma.staffEncounterAccess.findMany({
        where: {
          hospitalId: context.hospitalId,
          userId: context.userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { encounterId: true },
      }),
      this.prisma.breakGlassAccess.findMany({
        where: {
          hospitalId: context.hospitalId,
          userId: context.userId,
          expiresAt: { gt: now },
        },
        select: { encounterId: true },
      }),
    ]);

    return [...new Set([...assigned, ...breakGlass].map((access) => access.encounterId))];
  }

  async getClinicallyAccessibleEncounterIds(
    context: StaffClinicalContext,
    encounterIds: number[],
  ): Promise<Set<number>> {
    const scope = await this.getClinicalEncounterScope(context);
    if (scope === null) {
      return new Set(encounterIds);
    }
    const requested = new Set(encounterIds);
    return new Set(scope.filter((encounterId) => requested.has(encounterId)));
  }

  async assertClinicalEncounterAccess(
    context: StaffClinicalContext,
    encounterId: number,
  ): Promise<void> {
    if (!this.canReadClinical(context.role)) {
      throw new ForbiddenException('This role cannot access clinical encounter information');
    }

    if (!this.careTeamEnforcementEnabled()) {
      return;
    }

    const now = new Date();
    const [assigned, breakGlass] = await Promise.all([
      this.prisma.staffEncounterAccess.findFirst({
        where: {
          encounterId,
          hospitalId: context.hospitalId,
          userId: context.userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true },
      }),
      this.prisma.breakGlassAccess.findFirst({
        where: {
          encounterId,
          hospitalId: context.hospitalId,
          userId: context.userId,
          expiresAt: { gt: now },
        },
        select: { id: true },
      }),
    ]);

    if (!assigned && !breakGlass) {
      throw new ForbiddenException('Clinical encounter access requires care-team assignment or break-glass access');
    }
  }

  async assertClinicalMessageAccess(context: StaffClinicalContext, messageId: number): Promise<number> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, hospitalId: context.hospitalId },
      select: { encounterId: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    await this.assertClinicalEncounterAccess(context, message.encounterId);
    return message.encounterId;
  }

  async assertClinicalAssetAccess(context: StaffClinicalContext, assetId: number): Promise<number> {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, hospitalId: context.hospitalId },
      select: { encounterId: true },
    });
    if (!asset?.encounterId) throw new NotFoundException('Asset not found');
    await this.assertClinicalEncounterAccess(context, asset.encounterId);
    return asset.encounterId;
  }

  async assertClinicalAssessmentAccess(context: StaffClinicalContext, assessmentId: number): Promise<number> {
    const assessment = await this.prisma.triageAssessment.findFirst({
      where: { id: assessmentId, hospitalId: context.hospitalId },
      select: { encounterId: true },
    });
    if (!assessment) throw new NotFoundException('Triage assessment not found');
    await this.assertClinicalEncounterAccess(context, assessment.encounterId);
    return assessment.encounterId;
  }

  async assertClinicalAlertAccess(context: StaffClinicalContext, alertId: number): Promise<number> {
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, hospitalId: context.hospitalId },
      select: { encounterId: true },
    });
    if (!alert) throw new NotFoundException('Alert not found');
    await this.assertClinicalEncounterAccess(context, alert.encounterId);
    return alert.encounterId;
  }

  async assertClinicalPatientAccess(context: StaffClinicalContext, patientId: number): Promise<void> {
    const scope = await this.getClinicalEncounterScope(context);
    const encounter = await this.prisma.encounter.findFirst({
      where: {
        hospitalId: context.hospitalId,
        patientId,
        ...(scope === null ? {} : { id: { in: scope } }),
      },
      select: { id: true },
    });
    if (!encounter) throw new NotFoundException('Patient not found');
  }

  async grantEncounterAccess(
    context: StaffClinicalContext,
    encounterId: number,
    dto: GrantEncounterAccessDto,
  ) {
    const encounter = await this.assertEncounterInHospital(encounterId, context.hospitalId);
    const target = await this.prisma.user.findFirst({
      where: { id: dto.userId, hospitalId: context.hospitalId, role: { in: [Role.NURSE, Role.DOCTOR, Role.ADMIN] } },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Clinical staff user not found in this hospital');
    }

    const expiresAt = dto.expiresInMinutes
      ? new Date(Date.now() + Math.min(dto.expiresInMinutes, 7 * 24 * 60) * 60_000)
      : null;

    return this.prisma.staffEncounterAccess.upsert({
      where: { encounterId_userId: { encounterId: encounter.id, userId: target.id } },
      create: {
        encounterId: encounter.id,
        hospitalId: context.hospitalId,
        userId: target.id,
        grantedByUserId: context.userId,
        expiresAt,
        reason: dto.reason?.trim() || null,
      },
      update: {
        grantedByUserId: context.userId,
        expiresAt,
        reason: dto.reason?.trim() || null,
      },
    });
  }

  async revokeEncounterAccess(
    context: StaffClinicalContext,
    encounterId: number,
    userId: number,
  ): Promise<{ ok: true }> {
    await this.assertEncounterInHospital(encounterId, context.hospitalId);
    const deleted = await this.prisma.staffEncounterAccess.deleteMany({
      where: {
        encounterId,
        hospitalId: context.hospitalId,
        userId,
      },
    });
    if (deleted.count !== 1) {
      throw new NotFoundException('Care-team assignment not found');
    }
    return { ok: true };
  }

  async createBreakGlassAccess(
    context: StaffClinicalContext,
    encounterId: number,
    dto: BreakGlassDto,
    correlationId?: string,
  ) {
    if (!this.canReadClinical(context.role)) {
      throw new ForbiddenException('This role cannot request break-glass access');
    }
    await this.assertEncounterInHospital(encounterId, context.hospitalId);
    const reason = dto.reason.trim();
    if (reason.length < 10) {
      throw new ForbiddenException('Break-glass access requires a specific reason');
    }

    const expiresAt = new Date(Date.now() + Math.min(dto.expiresInMinutes ?? 30, 60) * 60_000);
    const access = await this.prisma.breakGlassAccess.create({
      data: {
        encounterId,
        hospitalId: context.hospitalId,
        userId: context.userId,
        reason,
        expiresAt,
        correlationId,
      },
    });
    await this.audit.record({
      resource: 'BREAK_GLASS',
      actorUserId: context.userId,
      hospitalId: context.hospitalId,
      encounterId,
      correlationId,
      metadata: { accessId: access.id, expiresAt: expiresAt.toISOString(), reason },
    });
    return access;
  }

  private async assertEncounterInHospital(encounterId: number, hospitalId: number) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id_hospitalId: { id: encounterId, hospitalId } },
      select: { id: true },
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }
    return encounter;
  }

  private careTeamEnforcementEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes((process.env.CARE_TEAM_ACCESS_REQUIRED || '').trim().toLowerCase());
  }
}
