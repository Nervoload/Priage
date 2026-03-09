import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  ContextSourceType,
  IdempotencyRecordStatus,
  Prisma,
  ReviewState,
  TrustTier,
  VisibilityScope,
} from '@prisma/client';
import { createHash } from 'crypto';

import { AssetsService } from '../assets/assets.service';
import { EventsService } from '../events/events.service';
import { IntakeSessionsService } from '../intake-sessions/intake-sessions.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContextItemDto } from './dto/create-context-item.dto';
import { CreatePlatformIntakeSessionDto } from './dto/create-platform-intake-session.dto';
import { ConfirmPlatformIntakeSessionDto } from './dto/confirm-platform-intake-session.dto';
import { PlatformPartnerContext } from './platform-auth.service';

type CommandResponse = {
  statusCode: number;
  body: unknown;
};

type CommandActionResult = CommandResponse & {
  intakeSessionId?: number;
  encounterId?: number;
  postCommit?: Array<() => Promise<void> | void>;
};

type IdempotencyReservation = {
  recordId: number;
};

type ClaimedReference =
  | { createdId: number; existing?: never }
  | { createdId?: never; existing: { id: number; intakeSessionId: number | null; encounterId: number | null } };

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intakeSessions: IntakeSessionsService,
    private readonly assetsService: AssetsService,
    private readonly events: EventsService,
    private readonly loggingService: LoggingService,
  ) {}

  async createIntakeSession(
    partner: PlatformPartnerContext,
    dto: CreatePlatformIntakeSessionDto,
    idempotencyKey: string | undefined,
    correlationId?: string,
  ): Promise<CommandResponse> {
    this.assertScope(partner, 'intake:create');

    return this.executeCommand(
      partner,
      'intake_session.create',
      dto,
      idempotencyKey,
      { requireIdempotency: true },
      async (tx) => {
        const claimedReference = dto.externalReferenceId
          ? await this.claimReferenceTx(tx, partner.partnerId, 'intake_session', dto.externalReferenceId)
          : null;

        if (claimedReference?.existing) {
          if (!claimedReference.existing.intakeSessionId) {
            throw new ConflictException('External intake reference is already being processed');
          }

          return {
            statusCode: 200,
            body: await this.intakeSessions.getReadModelByIntakeSessionIdTx(
              tx,
              claimedReference.existing.intakeSessionId,
              partner.hospitalId,
            ),
            intakeSessionId: claimedReference.existing.intakeSessionId,
            encounterId: claimedReference.existing.encounterId ?? undefined,
          };
        }

        const intakeSession = await this.intakeSessions.createDraftTx(tx, {
          hospitalId: partner.hospitalId,
          expiresAt: dto.expiresAt ?? null,
        });

        if (dto.initialContext) {
          await this.intakeSessions.appendContextItemByIntakeSessionIdTx(
            tx,
            intakeSession.id,
            this.buildPolicyBoundItem(
              partner,
              dto.initialContext.itemType,
              dto.initialContext.schemaVersion,
              dto.initialContext.payload as Prisma.InputJsonValue,
              dto.initialContext.supersedesPublicId,
            ),
          );
        }

        if (claimedReference?.createdId) {
          await tx.partnerReference.update({
            where: { id: claimedReference.createdId },
            data: {
              intakeSessionId: intakeSession.id,
            },
          });
        }

        return {
          statusCode: 201,
          body: await this.intakeSessions.getReadModelByIntakeSessionIdTx(tx, intakeSession.id, partner.hospitalId),
          intakeSessionId: intakeSession.id,
        };
      },
      correlationId,
    );
  }

  async appendContextItem(
    partner: PlatformPartnerContext,
    publicId: string,
    dto: CreateContextItemDto,
    idempotencyKey: string | undefined,
    correlationId?: string,
  ): Promise<CommandResponse> {
    this.assertScope(partner, 'intake:write');

    return this.executeCommand(
      partner,
      'intake_session.context_item.create',
      { publicId, ...dto },
      idempotencyKey,
      { requireIdempotency: false },
      async (tx) => {
        const created = await this.intakeSessions.appendContextItemByPublicIdTx(
          tx,
          publicId,
          partner.hospitalId,
          this.buildPolicyBoundItem(
            partner,
            dto.itemType,
            dto.schemaVersion,
            dto.payload as Prisma.InputJsonValue,
            dto.supersedesPublicId,
          ),
        );

        return {
          statusCode: 201,
          body: created,
          intakeSessionId: created.intakeSessionId ?? undefined,
          encounterId: created.encounterId ?? undefined,
        };
      },
      correlationId,
    );
  }

  async uploadAssets(
    partner: PlatformPartnerContext,
    publicId: string,
    files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>,
    idempotencyKey: string | undefined,
    correlationId?: string,
  ): Promise<CommandResponse> {
    this.assertScope(partner, 'intake:write');

    const fingerprintPayload = files.map((file) => ({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
    }));

    return this.executeCommand(
      partner,
      'intake_session.asset.upload',
      { publicId, files: fingerprintPayload },
      idempotencyKey,
      { requireIdempotency: false, useTransaction: false },
      async () => {
        const assets = await this.assetsService.uploadIntakeImagesForPlatformSession(
          publicId,
          partner.hospitalId,
          files,
          correlationId,
        );

        return {
          statusCode: 201,
          body: assets,
        };
      },
      correlationId,
    );
  }

  async confirmIntakeSession(
    partner: PlatformPartnerContext,
    publicId: string,
    dto: ConfirmPlatformIntakeSessionDto,
    idempotencyKey: string | undefined,
    correlationId?: string,
  ): Promise<CommandResponse> {
    this.assertScope(partner, 'intake:confirm');

    return this.executeCommand(
      partner,
      'intake_session.confirm',
      { publicId, ...dto },
      idempotencyKey,
      { requireIdempotency: true },
      async (tx) => {
        if (partner.trustPolicy.requirePatientConfirmation && !dto.patientConfirmed) {
          throw new BadRequestException(
            'This partner workflow requires patient confirmation before confirmation',
          );
        }

        const claimedReference = dto.encounterReferenceId
          ? await this.claimReferenceTx(tx, partner.partnerId, 'encounter', dto.encounterReferenceId)
          : null;

        if (claimedReference?.existing) {
          if (!claimedReference.existing.encounterId) {
            throw new ConflictException('Encounter reference is already being processed');
          }

          return {
            statusCode: 200,
            body: await this.intakeSessions.getEncounterStatusByIdTx(
              tx,
              claimedReference.existing.encounterId,
              partner.hospitalId,
            ),
            encounterId: claimedReference.existing.encounterId,
          };
        }

        const confirmed = await this.intakeSessions.confirmByPublicIdTx(
          tx,
          publicId,
          partner.hospitalId,
          {
            hospitalId: partner.hospitalId,
            sourceLabel: 'platform_partner',
            patientConfirmed: dto.patientConfirmed ?? false,
          },
        );

        if (claimedReference?.createdId) {
          await tx.partnerReference.update({
            where: { id: claimedReference.createdId },
            data: {
              encounterId: confirmed.encounter.id,
            },
          });
        }

        return {
          statusCode: 200,
          body: await this.intakeSessions.getEncounterStatusByIdTx(tx, confirmed.encounter.id, partner.hospitalId),
          encounterId: confirmed.encounter.id,
          postCommit: confirmed.event
            ? [async () => {
              await this.events.dispatchEncounterEventAndMarkProcessed(confirmed.event!);
            }]
            : [],
        };
      },
      correlationId,
    );
  }

  async cancelIntakeSession(
    partner: PlatformPartnerContext,
    publicId: string,
    idempotencyKey: string | undefined,
    correlationId?: string,
  ): Promise<CommandResponse> {
    this.assertScope(partner, 'intake:confirm');

    return this.executeCommand(
      partner,
      'intake_session.cancel',
      { publicId },
      idempotencyKey,
      { requireIdempotency: false },
      async (tx) => ({
        statusCode: 200,
        body: await this.intakeSessions.cancelByPublicIdTx(tx, publicId, partner.hospitalId),
      }),
      correlationId,
    );
  }

  async getIntakeSession(partner: PlatformPartnerContext, publicId: string) {
    this.assertScope(partner, 'intake:read');
    return this.intakeSessions.getReadModelByPublicId(publicId, partner.hospitalId);
  }

  async getEncounterStatus(partner: PlatformPartnerContext, publicId: string) {
    this.assertScope(partner, 'encounter:read');
    return this.intakeSessions.getEncounterStatus(publicId, partner.hospitalId);
  }

  private buildPolicyBoundItem(
    partner: PlatformPartnerContext,
    itemType: string,
    schemaVersion: string,
    payload: Prisma.InputJsonValue,
    supersedesPublicId?: string,
  ) {
    const trustTier = partner.trustPolicy.defaultTrustTier as TrustTier;
    const visibilityScope = partner.trustPolicy.allowPreConfirmOperationalUse
      ? (partner.trustPolicy.defaultVisibilityScope as VisibilityScope)
      : VisibilityScope.STORED_ONLY;
    const sourceType = trustTier === TrustTier.INSTITUTION_TRUSTED
      ? ContextSourceType.INSTITUTION
      : ContextSourceType.PARTNER;

    return {
      itemType,
      schemaVersion,
      payload,
      sourceType,
      trustTier,
      reviewState: ReviewState.UNREVIEWED,
      visibilityScope,
      hospitalId: partner.hospitalId,
      partnerId: partner.partnerId,
      supersedesPublicId,
    };
  }

  private async executeCommand(
    partner: PlatformPartnerContext,
    command: string,
    fingerprintInput: unknown,
    idempotencyKey: string | undefined,
    options: { requireIdempotency: boolean; useTransaction?: boolean },
    action: (tx: Prisma.TransactionClient) => Promise<CommandActionResult>,
    correlationId?: string,
  ): Promise<CommandResponse> {
    const requestFingerprint = this.createFingerprint(fingerprintInput);

    if (options.requireIdempotency && !idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required for this command');
    }

    let reservation: IdempotencyReservation | null = null;
    if (idempotencyKey) {
      const resolved = await this.reserveIdempotency(partner, command, idempotencyKey, requestFingerprint);
      if ('statusCode' in resolved) {
        return resolved;
      }
      reservation = resolved;
    }

    try {
      const response = options.useTransaction === false
        ? await this.executeNonTransactionalCommand(
          partner,
          command,
          requestFingerprint,
          reservation,
          action,
        )
        : await this.executeTransactionalCommand(
          partner,
          command,
          requestFingerprint,
          reservation,
          action,
        );

      await this.loggingService.info(
        'Executed platform command',
        {
          service: 'PlatformService',
          operation: 'executeCommand',
          correlationId,
          hospitalId: partner.hospitalId,
        },
        {
          partnerId: partner.partnerId,
          command,
          idempotencyKey: idempotencyKey ?? null,
          statusCode: response.statusCode,
        },
      );

      return response;
    } catch (error) {
      if (reservation) {
        await this.markReservationFailed(reservation.recordId);
      }
      throw error;
    }
  }

  private async executeTransactionalCommand(
    partner: PlatformPartnerContext,
    command: string,
    requestFingerprint: string,
    reservation: IdempotencyReservation | null,
    action: (tx: Prisma.TransactionClient) => Promise<CommandActionResult>,
  ): Promise<CommandResponse> {
    const { response, postCommit } = await this.prisma.$transaction(async (tx) => {
      const result = await action(tx);
      const responseBody = this.toJsonBody(result.body);

      const commandResult = await tx.commandResult.create({
        data: {
          partnerCredentialId: partner.credentialId,
          command,
          requestFingerprint,
          responseStatus: result.statusCode,
          responseBody,
          intakeSessionId: result.intakeSessionId,
          encounterId: result.encounterId,
        },
      });

      if (reservation) {
        await tx.idempotencyRecord.update({
          where: { id: reservation.recordId },
          data: {
            status: IdempotencyRecordStatus.COMPLETED,
            completedAt: new Date(),
            commandResultId: commandResult.id,
          },
        });
      }

      return {
        response: {
          statusCode: result.statusCode,
          body: responseBody,
        },
        postCommit: result.postCommit ?? [],
      };
    });

    await this.runPostCommit(postCommit);
    return response;
  }

  private async executeNonTransactionalCommand(
    partner: PlatformPartnerContext,
    command: string,
    requestFingerprint: string,
    reservation: IdempotencyReservation | null,
    action: (tx: Prisma.TransactionClient) => Promise<CommandActionResult>,
  ): Promise<CommandResponse> {
    const result = await action(this.prisma as unknown as Prisma.TransactionClient);
    const responseBody = this.toJsonBody(result.body);

    await this.prisma.$transaction(async (tx) => {
      const commandResult = await tx.commandResult.create({
        data: {
          partnerCredentialId: partner.credentialId,
          command,
          requestFingerprint,
          responseStatus: result.statusCode,
          responseBody,
          intakeSessionId: result.intakeSessionId,
          encounterId: result.encounterId,
        },
      });

      if (reservation) {
        await tx.idempotencyRecord.update({
          where: { id: reservation.recordId },
          data: {
            status: IdempotencyRecordStatus.COMPLETED,
            completedAt: new Date(),
            commandResultId: commandResult.id,
          },
        });
      }
    });

    await this.runPostCommit(result.postCommit ?? []);
    return {
      statusCode: result.statusCode,
      body: responseBody,
    };
  }

  private async reserveIdempotency(
    partner: PlatformPartnerContext,
    command: string,
    idempotencyKey: string,
    requestFingerprint: string,
  ): Promise<IdempotencyReservation | CommandResponse> {
    while (true) {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: {
          partnerCredentialId_command_idempotencyKey: {
            partnerCredentialId: partner.credentialId,
            command,
            idempotencyKey,
          },
        },
        include: { commandResult: true },
      });

      if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) {
          throw new ConflictException('Idempotency key has already been used with a different request');
        }

        if (existing.status === IdempotencyRecordStatus.COMPLETED && existing.commandResult) {
          return {
            statusCode: existing.commandResult.responseStatus,
            body: existing.commandResult.responseBody,
          };
        }

        if (existing.status === IdempotencyRecordStatus.IN_PROGRESS) {
          throw new ConflictException('An identical request is already in progress for this idempotency key');
        }

        if (existing.status === IdempotencyRecordStatus.FAILED) {
          const reclaimed = await this.prisma.idempotencyRecord.updateMany({
            where: {
              id: existing.id,
              status: IdempotencyRecordStatus.FAILED,
              requestFingerprint,
            },
            data: {
              status: IdempotencyRecordStatus.IN_PROGRESS,
              completedAt: null,
              commandResultId: null,
            },
          });

          if (reclaimed.count === 1) {
            return { recordId: existing.id };
          }

          continue;
        }
      }

      try {
        const created = await this.prisma.idempotencyRecord.create({
          data: {
            partnerCredentialId: partner.credentialId,
            command,
            idempotencyKey,
            requestFingerprint,
            status: IdempotencyRecordStatus.IN_PROGRESS,
          },
          select: { id: true },
        });

        return { recordId: created.id };
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }
  }

  private async claimReferenceTx(
    tx: Prisma.TransactionClient,
    partnerId: number,
    referenceType: string,
    referenceValue: string,
  ): Promise<ClaimedReference> {
    const claimed = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
      INSERT INTO "PartnerReference" ("createdAt", "partnerId", "referenceType", "referenceValue")
      VALUES (NOW(), ${partnerId}, ${referenceType}, ${referenceValue})
      ON CONFLICT ("partnerId", "referenceType", "referenceValue") DO NOTHING
      RETURNING "id"
    `);

    if (claimed.length > 0) {
      return { createdId: claimed[0].id };
    }

    const existing = await tx.partnerReference.findUnique({
      where: {
        partnerId_referenceType_referenceValue: {
          partnerId,
          referenceType,
          referenceValue,
        },
      },
      select: {
        id: true,
        intakeSessionId: true,
        encounterId: true,
      },
    });

    if (!existing) {
      throw new ConflictException('Reference reservation could not be resolved');
    }

    return { existing };
  }

  private async markReservationFailed(recordId: number) {
    await this.prisma.idempotencyRecord.updateMany({
      where: {
        id: recordId,
        status: IdempotencyRecordStatus.IN_PROGRESS,
      },
      data: {
        status: IdempotencyRecordStatus.FAILED,
        completedAt: new Date(),
      },
    });
  }

  private async runPostCommit(callbacks: Array<() => Promise<void> | void>) {
    for (const callback of callbacks) {
      try {
        await callback();
      } catch (error) {
        await this.loggingService.error(
          'Platform post-commit callback failed',
          {
            service: 'PlatformService',
            operation: 'runPostCommit',
            correlationId: undefined,
          },
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  }

  private assertScope(partner: PlatformPartnerContext, requiredScope: string) {
    if (!partner.scopes.includes(requiredScope)) {
      throw new ForbiddenException(`Partner credential is missing required scope: ${requiredScope}`);
    }
  }

  private createFingerprint(input: unknown) {
    return createHash('sha256').update(this.stableStringify(input)).digest('hex');
  }

  private toJsonBody(body: unknown) {
    return JSON.parse(JSON.stringify(body));
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${this.stableStringify(entryValue)}`);

    return `{${entries.join(',')}}`;
  }

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
