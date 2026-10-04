import { Injectable } from '@nestjs/common';
import { SensitiveReadResource } from '@prisma/client';

import { SensitiveReadAuditService } from '../../audit/sensitive-read-audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ClinicPilotService } from '../clinic-pilot.service';
import { summarizeAssessments } from './assessment-analytics';

type Staff = { userId: number; hospitalId: number };

export const ANALYTICS_PERIODS = [7, 30, 90] as const;
const MAX_SNAPSHOTS = 3000;

@Injectable()
export class ClinicAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pilot: ClinicPilotService,
    private readonly audit: SensitiveReadAuditService,
  ) {}

  /** How Priage's assessment suggestions are landing with this clinic's clinicians. */
  async assessment(staff: Staff, requestedDays?: number) {
    this.pilot.assertTenantEnabled(staff.hospitalId);
    const days = ANALYTICS_PERIODS.find((period) => period === requestedDays) ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60_000);
    const hospitalId = staff.hospitalId;
    const [snapshots, feedback, askQuestions] = await Promise.all([
      this.prisma.careAssessmentSnapshot.findMany({ where: { hospitalId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: MAX_SNAPSHOTS, select: { id: true, encounterId: true, version: true, content: true } }),
      this.prisma.careAiFeedback.findMany({ where: { hospitalId, updatedAt: { gte: since } }, select: { kind: true, sectionKey: true, ruleId: true, generatorKind: true, generatorVersion: true, segmentId: true, snapshotId: true, note: true, updatedAt: true } }),
      this.prisma.careOpenQuestion.findMany({ where: { hospitalId, createdAt: { gte: since }, sourceSegmentId: { not: null } }, select: { addressedAt: true, answerText: true } }),
    ]);

    // Notes quote the item they're about, which may sit on an older snapshot.
    const contentById = new Map<number, unknown>(snapshots.map((row) => [row.id, row.content]));
    const noteSnapshotIds = [...new Set(feedback.filter((row) => row.note && row.segmentId).map((row) => row.snapshotId))].filter((id) => !contentById.has(id));
    if (noteSnapshotIds.length) {
      for (const row of await this.prisma.careAssessmentSnapshot.findMany({ where: { id: { in: noteSnapshotIds }, hospitalId }, select: { id: true, content: true } })) contentById.set(row.id, row.content);
    }
    const segmentText = (snapshotId: number, segmentId: string) => {
      const segments = (contentById.get(snapshotId) as { segments?: Array<{ id: string; text: string }> } | undefined)?.segments ?? [];
      return segments.find((segment) => segment.id === segmentId)?.text ?? null;
    };

    const summary = summarizeAssessments({
      snapshots,
      segmentText,
      feedback: feedback.map((row) => ({ ...row, createdAt: row.updatedAt })),
      askQuestions,
    });
    await this.audit.record({ resource: SensitiveReadResource.ENCOUNTER_LIST, actorUserId: staff.userId, hospitalId,
      metadata: { workflow: 'CLINIC_APPOINTMENT', view: 'care_assessment_analytics', days, visits: summary.visits } });
    return { days, since, truncated: snapshots.length >= MAX_SNAPSHOTS, ...summary };
  }
}
