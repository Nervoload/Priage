// Shared intake-session orchestration service.
// Coordinates draft intake, context attachment, confirmation, cancellation,
// and encounter projection for any entrypoint that creates/updates intake:
// first-party patient flows and the partner-facing platform API.

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssetStatus,
  ContextSourceType,
  Encounter,
  EncounterEvent,
  EncounterStatus,
  EventType,
  IntakeSession,
  IntakeSessionStatus,
  Prisma,
  ReviewState,
  SummaryProjectionKind,
  TrustTier,
  VisibilityScope,
} from '@prisma/client';
import { randomUUID } from 'crypto';

import { EventsService } from '../events/events.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';

type DraftProjection = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  age?: number;
  gender?: string;
  allergies?: string;
  conditions?: string;
  preferredLanguage?: string;
  chiefComplaint?: string;
  details?: string;
  itemIds: number[];
  sourceType: ContextSourceType;
  trustTier: TrustTier;
  reviewState: ReviewState;
  visibilityScope: VisibilityScope;
};

type ReadModelSession = Prisma.IntakeSessionGetPayload<{
  include: {
    contextItems: { orderBy: { createdAt: 'asc' } };
    summaries: { where: { active: true }; orderBy: { createdAt: 'desc' } };
    encounter: {
      select: {
        id: true;
        publicId: true;
        status: true;
        hospitalId: true;
        expectedAt: true;
        arrivedAt: true;
        triagedAt: true;
        waitingAt: true;
        departedAt: true;
        cancelledAt: true;
      };
    };
  };
}>;

export type CreateDraftArgs = {
  patientId?: number | null;
  authSessionId?: number | null;
  hospitalId?: number | null;
  expiresAt?: Date | null;
};

export type AppendContextItemArgs = {
  itemType: string;
  schemaVersion?: string;
  payload: Prisma.InputJsonValue;
  sourceType: ContextSourceType;
  trustTier: TrustTier;
  reviewState: ReviewState;
  visibilityScope: VisibilityScope;
  hospitalId?: number | null;
  patientId?: number | null;
  partnerId?: number | null;
  supersedesPublicId?: string;
};

export type ConfirmIntakeSessionArgs = {
  hospitalId?: number | null;
  sourceLabel: string;
  patientConfirmed?: boolean;
};

export type ConfirmIntakeSessionTxResult = {
  encounter: Encounter;
  event: EncounterEvent | null;
};

@Injectable()
export class IntakeSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly loggingService: LoggingService,
  ) {}

  async createDraft(args: CreateDraftArgs, correlationId?: string) {
    const created = await this.prisma.$transaction((tx) => this.createDraftTx(tx, args));

    await this.loggingService.info(
      'Created intake session draft',
      {
        service: 'IntakeSessionsService',
        operation: 'createDraft',
        correlationId,
        patientId: created.patientId ?? undefined,
        hospitalId: created.hospitalId ?? undefined,
      },
      {
        intakeSessionId: created.id,
        intakeSessionPublicId: created.publicId,
        authSessionId: created.authSessionId,
      },
    );

    return created;
  }

  async createDraftTx(tx: Prisma.TransactionClient, args: CreateDraftArgs) {
    return tx.intakeSession.create({
      data: {
        publicId: this.newPublicId('intake'),
        patientId: args.patientId ?? null,
        authSessionId: args.authSessionId ?? null,
        hospitalId: args.hospitalId ?? null,
        expiresAt: args.expiresAt ?? null,
      },
    });
  }

  async getByPublicId(publicId: string, hospitalId?: number | null) {
    const session = await this.prisma.$transaction((tx) => this.findSessionForReadModelTx(tx, { publicId }, hospitalId));

    if (!session) {
      throw new NotFoundException(`Intake session ${publicId} not found`);
    }

    return session;
  }

  async getReadModelByPublicId(publicId: string, hospitalId?: number | null) {
    const session = await this.getByPublicId(publicId, hospitalId);
    return this.toReadModel(session);
  }

  async getReadModelByIntakeSessionId(intakeSessionId: number, hospitalId?: number | null) {
    return this.prisma.$transaction((tx) => this.getReadModelByIntakeSessionIdTx(tx, intakeSessionId, hospitalId));
  }

  async getLatestForAuthSession(authSessionId: number) {
    return this.prisma.intakeSession.findFirst({
      where: { authSessionId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async getOrCreateDraftForAuthSession(
    authSessionId: number,
    patientId: number,
    correlationId?: string,
  ) {
    const draft = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT 1
        FROM "PatientSession"
        WHERE "id" = ${authSessionId}
        FOR UPDATE
      `;

      const existing = await this.findLatestActiveDraftByAuthSessionIdTx(tx, authSessionId);
      if (existing) {
        return existing;
      }

      return this.createDraftTx(tx, {
        authSessionId,
        patientId,
      });
    });

    await this.loggingService.debug(
      'Resolved intake session draft for auth session',
      {
        service: 'IntakeSessionsService',
        operation: 'getOrCreateDraftForAuthSession',
        correlationId,
        patientId,
      },
      {
        authSessionId,
        intakeSessionId: draft.id,
        intakeSessionPublicId: draft.publicId,
      },
    );

    return draft;
  }

  async appendContextItemByAuthSession(
    authSessionId: number,
    patientId: number,
    args: AppendContextItemArgs,
    correlationId?: string,
  ) {
    const session = await this.getOrCreateDraftForAuthSession(authSessionId, patientId, correlationId);
    return this.appendContextItemByIntakeSessionId(session.id, args, correlationId);
  }

  async appendContextItemByPublicId(
    publicId: string,
    hospitalId: number,
    args: AppendContextItemArgs,
    correlationId?: string,
  ) {
    const created = await this.prisma.$transaction((tx) =>
      this.appendContextItemByPublicIdTx(tx, publicId, hospitalId, args),
    );

    await this.logContextAppend(created, correlationId);
    return created;
  }

  async appendContextItemByPublicIdTx(
    tx: Prisma.TransactionClient,
    publicId: string,
    hospitalId: number,
    args: AppendContextItemArgs,
  ) {
    const session = await tx.intakeSession.findFirst({
      where: {
        publicId,
        OR: [{ hospitalId }, { hospitalId: null }],
      },
      select: { id: true },
    });

    if (!session) {
      throw new NotFoundException(`Intake session ${publicId} not found`);
    }

    return this.appendContextItemByIntakeSessionIdTx(tx, session.id, args);
  }

  async appendContextItemByIntakeSessionId(
    intakeSessionId: number,
    args: AppendContextItemArgs,
    correlationId?: string,
  ) {
    const created = await this.prisma.$transaction((tx) =>
      this.appendContextItemByIntakeSessionIdTx(tx, intakeSessionId, args),
    );

    await this.logContextAppend(created, correlationId);
    return created;
  }

  async appendContextItemByIntakeSessionIdTx(
    tx: Prisma.TransactionClient,
    intakeSessionId: number,
    args: AppendContextItemArgs,
  ) {
    const session = await tx.intakeSession.findUnique({
      where: { id: intakeSessionId },
      select: {
        id: true,
        publicId: true,
        status: true,
        patientId: true,
        hospitalId: true,
        encounterId: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`Intake session ${intakeSessionId} not found`);
    }

    if (session.status === IntakeSessionStatus.CANCELLED || session.status === IntakeSessionStatus.EXPIRED) {
      throw new BadRequestException(`Intake session ${session.publicId} is not writable`);
    }

    let supersedesId: number | undefined;
    if (args.supersedesPublicId) {
      const superseded = await tx.contextItem.findFirst({
        where: { publicId: args.supersedesPublicId, intakeSessionId },
        select: { id: true },
      });
      if (!superseded) {
        throw new NotFoundException(`Context item ${args.supersedesPublicId} not found`);
      }
      supersedesId = superseded.id;
    }

    const item = await tx.contextItem.create({
      data: {
        publicId: this.newPublicId('ctx'),
        intakeSessionId,
        encounterId: session.encounterId ?? null,
        hospitalId: args.hospitalId ?? session.hospitalId ?? null,
        patientId: args.patientId ?? session.patientId ?? null,
        partnerId: args.partnerId ?? null,
        itemType: args.itemType,
        schemaVersion: args.schemaVersion ?? 'v1',
        payload: args.payload,
        sourceType: args.sourceType,
        trustTier: args.trustTier,
        reviewState: args.reviewState,
        visibilityScope: args.visibilityScope,
        supersedesId,
      },
    });

    const projection = await this.buildOperationalProjectionTx(tx, intakeSessionId);
    await this.refreshOperationalSummaryTx(tx, intakeSessionId, session.encounterId, projection);

    if (session.encounterId) {
      await this.syncEncounterProjectionTx(tx, session.encounterId, projection);
    }

    return item;
  }

  async confirmByAuthSession(
    authSessionId: number,
    patientId: number,
    args: ConfirmIntakeSessionArgs,
    correlationId?: string,
  ) {
    const session = await this.getOrCreateDraftForAuthSession(authSessionId, patientId, correlationId);
    return this.confirmByIntakeSessionId(
      session.id,
      {
        ...args,
        patientConfirmed: true,
      },
      correlationId,
    );
  }

  async confirmByPublicId(
    publicId: string,
    hospitalId: number,
    args: ConfirmIntakeSessionArgs,
    correlationId?: string,
  ) {
    const result = await this.prisma.$transaction((tx) =>
      this.confirmByPublicIdTx(tx, publicId, hospitalId, { ...args, hospitalId }),
    );

    if (result.event) {
      await this.events.dispatchEncounterEventAndMarkProcessed(result.event);
    }

    await this.logConfirmation(result.encounter, publicId, args.sourceLabel, correlationId);
    return result.encounter;
  }

  async confirmByPublicIdTx(
    tx: Prisma.TransactionClient,
    publicId: string,
    hospitalId: number,
    args: ConfirmIntakeSessionArgs,
  ): Promise<ConfirmIntakeSessionTxResult> {
    const session = await tx.intakeSession.findFirst({
      where: {
        publicId,
        OR: [{ hospitalId }, { hospitalId: null }],
      },
      select: { id: true },
    });

    if (!session) {
      throw new NotFoundException(`Intake session ${publicId} not found`);
    }

    return this.confirmByIntakeSessionIdTx(tx, session.id, { ...args, hospitalId });
  }

  async confirmByIntakeSessionId(
    intakeSessionId: number,
    args: ConfirmIntakeSessionArgs,
    correlationId?: string,
  ) {
    const result = await this.prisma.$transaction((tx) =>
      this.confirmByIntakeSessionIdTx(tx, intakeSessionId, args),
    );

    if (result.event) {
      await this.events.dispatchEncounterEventAndMarkProcessed(result.event);
    }

    await this.logConfirmation(result.encounter, intakeSessionId, args.sourceLabel, correlationId);
    return result.encounter;
  }

  async confirmByIntakeSessionIdTx(
    tx: Prisma.TransactionClient,
    intakeSessionId: number,
    args: ConfirmIntakeSessionArgs,
  ): Promise<ConfirmIntakeSessionTxResult> {
    await tx.$executeRaw`
      SELECT 1
      FROM "IntakeSession"
      WHERE "id" = ${intakeSessionId}
      FOR UPDATE
    `;

    const session = await tx.intakeSession.findUnique({
      where: { id: intakeSessionId },
      include: {
        authSession: {
          select: {
            id: true,
            patientId: true,
            encounterId: true,
          },
        },
        encounter: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`Intake session ${intakeSessionId} not found`);
    }
    if (session.status === IntakeSessionStatus.CANCELLED || session.status === IntakeSessionStatus.EXPIRED) {
      throw new BadRequestException(`Intake session ${session.publicId} is not confirmable`);
    }
    if (session.encounterId && session.encounter) {
      return { encounter: session.encounter, event: null };
    }

    const hospitalId = args.hospitalId ?? session.hospitalId;
    if (!hospitalId) {
      throw new BadRequestException('hospitalId is required to confirm an intake session');
    }

    if (args.patientConfirmed) {
      await tx.contextItem.updateMany({
        where: {
          intakeSessionId,
          reviewState: ReviewState.UNREVIEWED,
          sourceType: {
            in: [ContextSourceType.PATIENT, ContextSourceType.PARTNER],
          },
        },
        data: {
          reviewState: ReviewState.PATIENT_CONFIRMED,
        },
      });

      await tx.contextItem.updateMany({
        where: {
          intakeSessionId,
          visibilityScope: VisibilityScope.STORED_ONLY,
          sourceType: {
            in: [ContextSourceType.PATIENT, ContextSourceType.PARTNER],
          },
        },
        data: {
          visibilityScope: VisibilityScope.ADMISSIONS,
        },
      });
    }

    const projection = await this.buildOperationalProjectionTx(tx, intakeSessionId);
    const patientId = await this.resolvePatientForConfirmationTx(tx, session);

    const encounter = await tx.encounter.create({
      data: {
        publicId: this.newPublicId('enc'),
        patientId,
        hospitalId,
        status: EncounterStatus.EXPECTED,
        chiefComplaint: projection.chiefComplaint,
        details: projection.details,
        expectedAt: new Date(),
      },
    });

    await tx.intakeSession.update({
      where: { id: intakeSessionId },
      data: {
        status: IntakeSessionStatus.CONFIRMED,
        confirmedAt: new Date(),
        hospitalId,
        patientId,
        encounterId: encounter.id,
      },
    });

    if (session.authSessionId) {
      await tx.patientSession.update({
        where: { id: session.authSessionId },
        data: { encounterId: encounter.id },
      });
    }

    await tx.asset.updateMany({
      where: {
        intakeSessionId,
        status: AssetStatus.READY,
      },
      data: {
        encounterId: encounter.id,
        hospitalId,
      },
    });

    await tx.contextItem.updateMany({
      where: { intakeSessionId },
      data: {
        encounterId: encounter.id,
        hospitalId,
        patientId,
      },
    });

    const refreshedProjection = await this.buildOperationalProjectionTx(tx, intakeSessionId);
    await this.refreshOperationalSummaryTx(tx, intakeSessionId, encounter.id, refreshedProjection);
    await this.syncEncounterProjectionTx(tx, encounter.id, refreshedProjection);

    const event = await this.events.emitEncounterEventTx(tx, {
      encounterId: encounter.id,
      hospitalId,
      type: EventType.ENCOUNTER_CREATED,
      metadata: {
        status: EncounterStatus.EXPECTED,
        intakeSessionPublicId: session.publicId,
        source: args.sourceLabel,
      },
      actor: session.patientId ? { actorPatientId: session.patientId } : undefined,
    });

    return { encounter, event };
  }

  async cancelByPublicId(publicId: string, hospitalId: number, correlationId?: string) {
    const result = await this.prisma.$transaction((tx) => this.cancelByPublicIdTx(tx, publicId, hospitalId));

    await this.loggingService.info(
      'Cancelled intake session',
      {
        service: 'IntakeSessionsService',
        operation: 'cancelByPublicId',
        correlationId,
        hospitalId,
      },
      {
        intakeSessionPublicId: publicId,
      },
    );

    return result;
  }

  async cancelByPublicIdTx(tx: Prisma.TransactionClient, publicId: string, hospitalId: number) {
    const result = await tx.intakeSession.updateMany({
      where: {
        publicId,
        status: IntakeSessionStatus.DRAFT,
        OR: [{ hospitalId }, { hospitalId: null }],
      },
      data: {
        status: IntakeSessionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new NotFoundException(`Intake session ${publicId} not found`);
    }

    return { ok: true };
  }

  async getEncounterStatus(publicId: string, hospitalId: number) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { publicId, hospitalId },
      select: {
        id: true,
        publicId: true,
        status: true,
        expectedAt: true,
        arrivedAt: true,
        triagedAt: true,
        waitingAt: true,
        seenAt: true,
        departedAt: true,
        cancelledAt: true,
      },
    });

    if (!encounter) {
      throw new NotFoundException(`Encounter ${publicId} not found`);
    }

    return encounter;
  }

  async getEncounterStatusByIdTx(tx: Prisma.TransactionClient, encounterId: number, hospitalId: number) {
    const encounter = await tx.encounter.findFirst({
      where: { id: encounterId, hospitalId },
      select: {
        id: true,
        publicId: true,
        status: true,
        expectedAt: true,
        arrivedAt: true,
        triagedAt: true,
        waitingAt: true,
        seenAt: true,
        departedAt: true,
        cancelledAt: true,
      },
    });

    if (!encounter) {
      throw new NotFoundException(`Encounter ${encounterId} not found`);
    }

    return encounter;
  }

  async getReadModelByIntakeSessionIdTx(
    tx: Prisma.TransactionClient,
    intakeSessionId: number,
    hospitalId?: number | null,
  ) {
    const session = await this.findSessionForReadModelTx(tx, { id: intakeSessionId }, hospitalId);

    if (!session) {
      throw new NotFoundException(`Intake session ${intakeSessionId} not found`);
    }

    return this.toReadModel(session);
  }

  private async findSessionForReadModelTx(
    tx: Prisma.TransactionClient,
    where: Prisma.IntakeSessionWhereInput,
    hospitalId?: number | null,
  ): Promise<ReadModelSession | null> {
    return tx.intakeSession.findFirst({
      where: {
        ...where,
        ...(hospitalId ? { OR: [{ hospitalId }, { hospitalId: null }] } : {}),
      },
      include: {
        contextItems: { orderBy: { createdAt: 'asc' } },
        summaries: { where: { active: true }, orderBy: { createdAt: 'desc' } },
        encounter: {
          select: {
            id: true,
            publicId: true,
            status: true,
            hospitalId: true,
            expectedAt: true,
            arrivedAt: true,
            triagedAt: true,
            waitingAt: true,
            departedAt: true,
            cancelledAt: true,
          },
        },
      },
    });
  }

  private async findLatestActiveDraftByAuthSessionIdTx(tx: Prisma.TransactionClient, authSessionId: number) {
    return tx.intakeSession.findFirst({
      where: {
        authSessionId,
        status: IntakeSessionStatus.DRAFT,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  private async resolvePatientForConfirmationTx(
    tx: Prisma.TransactionClient,
    session: {
      patientId: number | null;
      authSession: { patientId: number } | null;
    },
  ) {
    const patientId = session.patientId ?? session.authSession?.patientId;
    if (patientId) {
      return patientId;
    }

    const created = await tx.patientProfile.create({
      data: {
        email: `${randomUUID()}@intake.local`,
        password: randomUUID(),
        preferredLanguage: 'en',
      },
      select: { id: true },
    });

    return created.id;
  }

  private async buildOperationalProjectionTx(
    tx: Prisma.TransactionClient,
    intakeSessionId: number,
  ): Promise<DraftProjection> {
    const items = await tx.contextItem.findMany({
      where: { intakeSessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        supersededBy: {
          select: { id: true },
        },
      },
    });

    return this.projectItems(items, (item) => {
      if (item.reviewState === ReviewState.REJECTED) {
        return false;
      }
      if (item.supersededBy.length > 0) {
        return false;
      }
      if (item.visibilityScope === VisibilityScope.STORED_ONLY) {
        return false;
      }
      if (item.sourceType === ContextSourceType.AI && item.itemType === 'ai_summary') {
        return false;
      }
      return true;
    });
  }

  private async buildPatientBindingProjectionTx(
    tx: Prisma.TransactionClient,
    intakeSessionId: number,
  ): Promise<DraftProjection> {
    const items = await tx.contextItem.findMany({
      where: { intakeSessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        supersededBy: {
          select: { id: true },
        },
      },
    });

    return this.projectItems(items, (item) => {
      if (item.reviewState === ReviewState.REJECTED) {
        return false;
      }
      if (item.supersededBy.length > 0) {
        return false;
      }
      if (item.sourceType === ContextSourceType.AI) {
        return false;
      }
      return (
        item.sourceType === ContextSourceType.PATIENT
        || item.reviewState === ReviewState.PATIENT_CONFIRMED
        || item.reviewState === ReviewState.STAFF_REVIEWED
      );
    });
  }

  private projectItems(
    items: Array<{
      id: number;
      itemType: string;
      payload: Prisma.JsonValue;
      sourceType: ContextSourceType;
      trustTier: TrustTier;
      reviewState: ReviewState;
      visibilityScope: VisibilityScope;
      supersededBy: Array<{ id: number }>;
    }>,
    include: (item: {
      id: number;
      itemType: string;
      payload: Prisma.JsonValue;
      sourceType: ContextSourceType;
      trustTier: TrustTier;
      reviewState: ReviewState;
      visibilityScope: VisibilityScope;
      supersededBy: Array<{ id: number }>;
    }) => boolean,
  ): DraftProjection {
    const projection: DraftProjection = {
      itemIds: [],
      sourceType: ContextSourceType.PATIENT,
      trustTier: TrustTier.UNTRUSTED,
      reviewState: ReviewState.UNREVIEWED,
      visibilityScope: VisibilityScope.STORED_ONLY,
    };

    for (const item of items) {
      if (!include(item)) {
        continue;
      }
      if (!item.payload || typeof item.payload !== 'object' || Array.isArray(item.payload)) {
        continue;
      }

      const payload = item.payload as Record<string, unknown>;
      projection.itemIds.push(item.id);
      projection.sourceType = item.sourceType;
      projection.trustTier = item.trustTier;
      projection.reviewState = item.reviewState;
      projection.visibilityScope = item.visibilityScope;

      this.assignString(payload, 'firstName', projection);
      this.assignString(payload, 'lastName', projection);
      this.assignString(payload, 'phone', projection);
      this.assignNumber(payload, 'age', projection);
      this.assignString(payload, 'gender', projection);
      this.assignString(payload, 'allergies', projection);
      this.assignString(payload, 'conditions', projection);
      this.assignString(payload, 'preferredLanguage', projection);
      this.assignString(payload, 'chiefComplaint', projection);
      this.assignString(payload, 'details', projection);
    }

    return projection;
  }

  private async refreshOperationalSummaryTx(
    tx: Prisma.TransactionClient,
    intakeSessionId: number,
    encounterId: number | null,
    projection: DraftProjection,
  ) {
    await tx.summaryProjection.updateMany({
      where: {
        intakeSessionId,
        kind: SummaryProjectionKind.OPERATIONAL,
        active: true,
      },
      data: { active: false },
    });

    if (projection.itemIds.length === 0) {
      return;
    }

    await tx.summaryProjection.create({
      data: {
        publicId: this.newPublicId('sum'),
        kind: SummaryProjectionKind.OPERATIONAL,
        intakeSessionId,
        encounterId,
        sourceType: projection.sourceType,
        trustTier: projection.trustTier,
        reviewState: projection.reviewState,
        visibilityScope: projection.visibilityScope,
        content: {
          chiefComplaint: projection.chiefComplaint ?? null,
          details: projection.details ?? null,
          patient: {
            firstName: projection.firstName ?? null,
            lastName: projection.lastName ?? null,
            phone: projection.phone ?? null,
            age: projection.age ?? null,
            gender: projection.gender ?? null,
            allergies: projection.allergies ?? null,
            conditions: projection.conditions ?? null,
            preferredLanguage: projection.preferredLanguage ?? null,
          },
          contextItemIds: projection.itemIds,
        },
      },
    });
  }

  private async syncEncounterProjectionTx(
    tx: Prisma.TransactionClient,
    encounterId: number,
    projection: DraftProjection,
  ) {
    await tx.encounter.update({
      where: { id: encounterId },
      data: {
        chiefComplaint: projection.chiefComplaint,
        details: projection.details,
      },
    });
  }

  private toReadModel(session: ReadModelSession) {
    const storedOnly = session.contextItems.filter((item) => item.visibilityScope === VisibilityScope.STORED_ONLY);
    const operational = session.contextItems.filter((item) => item.visibilityScope !== VisibilityScope.STORED_ONLY);
    const summaries = session.summaries.reduce<Record<string, unknown[]>>((acc, summary) => {
      const key = summary.kind.toLowerCase();
      acc[key] = acc[key] ?? [];
      acc[key].push(summary);
      return acc;
    }, {});

    return {
      publicId: session.publicId,
      status: session.status,
      hospitalId: session.hospitalId,
      patientId: session.patientId,
      encounter: session.encounter,
      storedContextItems: storedOnly,
      operationalContextItems: operational,
      summaries,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      confirmedAt: session.confirmedAt,
      cancelledAt: session.cancelledAt,
      expiresAt: session.expiresAt,
    };
  }

  private async logContextAppend(
    created: {
      id: number;
      publicId: string;
      intakeSessionId: number | null;
      patientId: number | null;
      hospitalId: number | null;
      encounterId: number | null;
      itemType: string;
      sourceType: ContextSourceType;
      trustTier: TrustTier;
      reviewState: ReviewState;
      visibilityScope: VisibilityScope;
    },
    correlationId?: string,
  ) {
    await this.loggingService.info(
      'Appended intake context item',
      {
        service: 'IntakeSessionsService',
        operation: 'appendContextItemByIntakeSessionId',
        correlationId,
        patientId: created.patientId ?? undefined,
        hospitalId: created.hospitalId ?? undefined,
        encounterId: created.encounterId ?? undefined,
      },
      {
        intakeSessionId: created.intakeSessionId,
        contextItemId: created.id,
        contextItemPublicId: created.publicId,
        itemType: created.itemType,
        sourceType: created.sourceType,
        trustTier: created.trustTier,
        reviewState: created.reviewState,
        visibilityScope: created.visibilityScope,
      },
    );
  }

  private async logConfirmation(
    encounter: Encounter,
    intakeSessionRef: number | string,
    sourceLabel: string,
    correlationId?: string,
  ) {
    await this.loggingService.info(
      'Confirmed intake session into encounter',
      {
        service: 'IntakeSessionsService',
        operation: 'confirmByIntakeSessionId',
        correlationId,
        patientId: encounter.patientId,
        hospitalId: encounter.hospitalId,
        encounterId: encounter.id,
      },
      {
        intakeSessionRef,
        encounterPublicId: encounter.publicId,
        sourceLabel,
      },
    );
  }

  private assignString(payload: Record<string, unknown>, key: keyof DraftProjection, target: DraftProjection) {
    const value = payload[key as string];
    if (typeof value === 'string' && value.trim()) {
      target[key] = value.trim() as never;
    }
  }

  private assignNumber(payload: Record<string, unknown>, key: keyof DraftProjection, target: DraftProjection) {
    const value = payload[key as string];
    if (typeof value === 'number' && Number.isFinite(value)) {
      target[key] = value as never;
    }
  }

  private newPublicId(prefix: string) {
    return `${prefix}_${randomUUID()}`;
  }
}
