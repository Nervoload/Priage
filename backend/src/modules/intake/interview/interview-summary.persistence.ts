import { ContextSourceType, Prisma, ReviewState, SummaryProjectionKind, TrustTier, VisibilityScope } from '@prisma/client';
import { randomUUID } from 'crypto';

import type { IntakeSessionsService } from '../../intake-sessions/intake-sessions.service';

export interface AiSummaryWrite {
  intakeSessionId: number;
  patientId: number;
  /** Payload of the ai_triage_summary item. */
  item: Record<string, unknown>;
  /** Content of the AI_DERIVED projection that replaces the active one. */
  projection: Record<string, unknown>;
}

const toJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/**
 * Stores a finished assessment's summary in the caller's transaction: an
 * ai_triage_summary item chained to the previous one, and a new active
 * AI_DERIVED projection. Shared by the legacy interview and the clinic harness.
 */
export async function persistAiSummaryTx(
  tx: Prisma.TransactionClient,
  intakeSessions: Pick<IntakeSessionsService, 'appendContextItemByIntakeSessionIdTx'>,
  write: AiSummaryWrite,
): Promise<void> {
  const latestSummary = await tx.contextItem.findFirst({
    where: { intakeSessionId: write.intakeSessionId, itemType: 'ai_triage_summary', supersededBy: { none: {} } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { publicId: true },
  });

  const createdSummary = await intakeSessions.appendContextItemByIntakeSessionIdTx(tx, write.intakeSessionId, {
    itemType: 'ai_triage_summary',
    schemaVersion: 'v3',
    payload: toJson(write.item),
    sourceType: ContextSourceType.AI,
    trustTier: TrustTier.UNTRUSTED,
    reviewState: ReviewState.UNREVIEWED,
    visibilityScope: VisibilityScope.ADMISSIONS,
    patientId: write.patientId,
    supersedesPublicId: latestSummary?.publicId,
  });

  await tx.summaryProjection.updateMany({
    where: { intakeSessionId: write.intakeSessionId, kind: SummaryProjectionKind.AI_DERIVED, active: true },
    data: { active: false },
  });

  await tx.summaryProjection.create({
    data: {
      publicId: `sum_${randomUUID()}`,
      kind: SummaryProjectionKind.AI_DERIVED,
      intakeSessionId: write.intakeSessionId,
      encounterId: createdSummary.encounterId ?? null,
      sourceType: ContextSourceType.AI,
      trustTier: TrustTier.UNTRUSTED,
      reviewState: ReviewState.UNREVIEWED,
      visibilityScope: VisibilityScope.CLINICAL,
      content: toJson(write.projection),
    },
  });
}
