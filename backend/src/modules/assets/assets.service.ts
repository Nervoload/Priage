import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'stream';
import {
  AssetContext,
  AssetStatus,
  Prisma,
} from '@prisma/client';

import { IntakeSessionsService } from '../intake-sessions/intake-sessions.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssetStorageService } from './asset-storage.service';
import { AssetSummaryDto, assetSummarySelect, mapAssetSummary } from './asset-summary.dto';
import {
  ASSET_ALLOWED_MIME_TYPES,
  ASSET_MAX_FILES_PER_REQUEST,
  ASSET_MAX_FILE_SIZE_BYTES,
} from './assets.constants';
import { readImageMetadata } from './image-metadata.util';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
};

type StaffAssetStream = {
  stream: Readable;
  mimeType: string;
  etag: string;
};

type AssetActorContext =
  | { actorUserId: number; actorPatientId?: never }
  | { actorUserId?: never; actorPatientId: number };

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intakeSessions: IntakeSessionsService,
    private readonly storage: AssetStorageService,
    private readonly loggingService: LoggingService,
  ) {}

  async uploadIntakeImagesForSession(
    sessionId: number,
    patientId: number,
    files: UploadedImageFile[],
    correlationId?: string,
  ): Promise<AssetSummaryDto[]> {
    const session = await this.prisma.patientSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        patientId: true,
        encounterId: true,
        encounter: {
          select: {
            hospitalId: true,
          },
        },
      },
    });

    if (!session || session.patientId !== patientId) {
      throw new NotFoundException('Patient session not found');
    }

    const intakeSession = await this.intakeSessions.getLatestForAuthSession(session.id);

    return this.persistUploadedImages(
      files,
      {
        context: AssetContext.INTAKE_IMAGE,
        patientSessionId: session.id,
        intakeSessionId: intakeSession?.id ?? null,
        encounterId: intakeSession?.encounterId ?? session.encounterId,
        hospitalId: intakeSession?.hospitalId ?? session.encounter?.hospitalId ?? null,
        createdByPatientId: patientId,
      },
      'patient',
      correlationId,
    );
  }

  async listIntakeImagesForSession(
    sessionId: number,
    patientId: number,
  ): Promise<AssetSummaryDto[]> {
    const session = await this.prisma.patientSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        patientId: true,
      },
    });

    if (!session || session.patientId !== patientId) {
      throw new NotFoundException('Patient session not found');
    }

    const intakeSession = await this.intakeSessions.getLatestForAuthSession(session.id);
    const assets = await this.prisma.asset.findMany({
      where: {
        OR: [
          { patientSessionId: sessionId },
          ...(intakeSession?.id ? [{ intakeSessionId: intakeSession.id }] : []),
        ],
        context: AssetContext.INTAKE_IMAGE,
        status: AssetStatus.READY,
      },
      select: assetSummarySelect,
      orderBy: { createdAt: 'asc' },
    });

    return assets.map((asset) => mapAssetSummary(asset, 'patient'));
  }

  async promoteSessionAssetsToEncounter(
    sessionId: number,
    encounterId: number,
    hospitalId: number,
    patientId: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.asset.updateMany({
      where: {
        OR: [
          {
            patientSessionId: sessionId,
            createdByPatientId: patientId,
          },
          {
            intakeSession: {
              authSessionId: sessionId,
            },
            createdByPatientId: patientId,
          },
        ],
        context: AssetContext.INTAKE_IMAGE,
        status: AssetStatus.READY,
      },
      data: {
        encounterId,
        hospitalId,
      },
    });
  }

  async uploadMessageImagesForPatient(
    encounterId: number,
    patientId: number,
    files: UploadedImageFile[],
    correlationId?: string,
  ): Promise<AssetSummaryDto[]> {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { id: true, patientId: true, hospitalId: true },
    });

    if (!encounter) {
      throw new NotFoundException(`Encounter ${encounterId} not found`);
    }

    if (encounter.patientId !== patientId) {
      throw new ForbiddenException('You can only upload images for your own encounters');
    }

    return this.persistUploadedImages(
      files,
      {
        context: AssetContext.MESSAGE_ATTACHMENT,
        encounterId: encounter.id,
        hospitalId: encounter.hospitalId,
        createdByPatientId: patientId,
      },
      'patient',
      correlationId,
    );
  }

  async uploadIntakeImagesForPlatformSession(
    publicId: string,
    hospitalId: number,
    files: UploadedImageFile[],
    correlationId?: string,
  ): Promise<AssetSummaryDto[]> {
    const intakeSession = await this.prisma.intakeSession.findFirst({
      where: {
        publicId,
        OR: [{ hospitalId }, { hospitalId: null }],
      },
      select: {
        id: true,
        encounterId: true,
        hospitalId: true,
      },
    });

    if (!intakeSession) {
      throw new NotFoundException(`Intake session ${publicId} not found`);
    }

    return this.persistUploadedImages(
      files,
      {
        context: AssetContext.INTAKE_IMAGE,
        intakeSessionId: intakeSession.id,
        encounterId: intakeSession.encounterId,
        hospitalId: intakeSession.hospitalId ?? hospitalId,
      },
      'staff',
      correlationId,
    );
  }

  async uploadMessageImagesForStaff(
    encounterId: number,
    hospitalId: number,
    userId: number,
    files: UploadedImageFile[],
    correlationId?: string,
  ): Promise<AssetSummaryDto[]> {
    const encounter = await this.prisma.encounter.findUnique({
      where: {
        id_hospitalId: {
          id: encounterId,
          hospitalId,
        },
      },
      select: { id: true, hospitalId: true },
    });

    if (!encounter) {
      throw new NotFoundException(`Encounter ${encounterId} not found for hospital`);
    }

    return this.persistUploadedImages(
      files,
      {
        context: AssetContext.MESSAGE_ATTACHMENT,
        encounterId: encounter.id,
        hospitalId: encounter.hospitalId,
        createdByUserId: userId,
      },
      'staff',
      correlationId,
    );
  }

  async attachAssetsToMessage(
    tx: Prisma.TransactionClient,
    assetIds: number[],
    messageId: number,
    encounterId: number,
    actor: AssetActorContext,
    audience: 'patient' | 'staff',
  ): Promise<AssetSummaryDto[]> {
    const normalizedAssetIds = [...new Set(assetIds)];
    if (normalizedAssetIds.length === 0) {
      return [];
    }

    const assets = await tx.asset.findMany({
      where: {
        id: { in: normalizedAssetIds },
        status: AssetStatus.READY,
        context: AssetContext.MESSAGE_ATTACHMENT,
      },
      select: {
        ...assetSummarySelect,
        createdByUserId: true,
        createdByPatientId: true,
      },
    });

    if (assets.length !== normalizedAssetIds.length) {
      throw new BadRequestException('One or more assets were not found');
    }

    for (const asset of assets) {
      if (asset.messageId) {
        throw new BadRequestException(`Asset ${asset.id} is already attached to a message`);
      }
      if (asset.encounterId !== encounterId) {
        throw new BadRequestException(`Asset ${asset.id} does not belong to encounter ${encounterId}`);
      }
      if ('actorUserId' in actor && asset.createdByUserId !== actor.actorUserId) {
        throw new ForbiddenException(`Asset ${asset.id} is not owned by this user`);
      }
      if ('actorPatientId' in actor && asset.createdByPatientId !== actor.actorPatientId) {
        throw new ForbiddenException(`Asset ${asset.id} is not owned by this patient`);
      }
    }

    const result = await tx.asset.updateMany({
      where: {
        id: { in: normalizedAssetIds },
        messageId: null,
        status: AssetStatus.READY,
      },
      data: {
        messageId,
      },
    });

    if (result.count !== normalizedAssetIds.length) {
      throw new BadRequestException('Failed to attach one or more assets to the message');
    }

    const updatedAssets = await tx.asset.findMany({
      where: { id: { in: normalizedAssetIds } },
      select: assetSummarySelect,
      orderBy: { createdAt: 'asc' },
    });

    return updatedAssets.map((asset) => mapAssetSummary(asset, audience));
  }

  async listEncounterAssets(encounterId: number, hospitalId: number): Promise<AssetSummaryDto[]> {
    const encounter = await this.prisma.encounter.findUnique({
      where: {
        id_hospitalId: {
          id: encounterId,
          hospitalId,
        },
      },
      select: { id: true },
    });

    if (!encounter) {
      throw new NotFoundException(`Encounter ${encounterId} not found`);
    }

    const assets = await this.prisma.asset.findMany({
      where: {
        encounterId,
        hospitalId,
        status: AssetStatus.READY,
      },
      select: assetSummarySelect,
      orderBy: { createdAt: 'asc' },
    });

    return assets.map((asset) => mapAssetSummary(asset, 'staff'));
  }

  async deleteAssetForPatient(assetId: number, patientId: number): Promise<{ ok: true }> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        status: true,
        messageId: true,
        storageKey: true,
        createdByPatientId: true,
      },
    });

    if (!asset || asset.createdByPatientId !== patientId) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    if (asset.status === AssetStatus.DELETED) {
      return { ok: true };
    }

    if (asset.messageId) {
      throw new BadRequestException('Attached message images cannot be deleted');
    }

    await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        status: AssetStatus.DELETED,
      },
    });

    await this.storage.delete(asset.storageKey);

    return { ok: true };
  }

  async streamAssetForStaff(assetId: number, hospitalId: number): Promise<StaffAssetStream> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        mimeType: true,
        sha256: true,
        updatedAt: true,
        storageKey: true,
        status: true,
        hospitalId: true,
      },
    });

    if (!asset || asset.status !== AssetStatus.READY || asset.hospitalId !== hospitalId) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    return {
      stream: this.storage.openReadStream(asset.storageKey),
      mimeType: asset.mimeType,
      etag: this.buildEtag(asset.id, asset.updatedAt, asset.sha256),
    };
  }

  async streamAssetForPatient(assetId: number, patientId: number): Promise<StaffAssetStream> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        context: true,
        messageId: true,
        mimeType: true,
        sha256: true,
        updatedAt: true,
        storageKey: true,
        status: true,
        createdByPatientId: true,
        message: {
          select: {
            isInternal: true,
          },
        },
        patientSession: {
          select: { patientId: true },
        },
        encounter: {
          select: { patientId: true },
        },
      },
    });

    if (!asset || asset.status !== AssetStatus.READY) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    const uploadedByPatient =
      asset.createdByPatientId === patientId || asset.patientSession?.patientId === patientId;
    const belongsToPatientEncounter = asset.encounter?.patientId === patientId;
    const isPatientVisibleEncounterAsset =
      belongsToPatientEncounter &&
      (
        asset.context === AssetContext.INTAKE_IMAGE ||
        (asset.messageId !== null && asset.message?.isInternal === false)
      );

    if (!uploadedByPatient && !isPatientVisibleEncounterAsset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    return {
      stream: this.storage.openReadStream(asset.storageKey),
      mimeType: asset.mimeType,
      etag: this.buildEtag(asset.id, asset.updatedAt, asset.sha256),
    };
  }

  private async persistUploadedImages(
    files: UploadedImageFile[],
    context: {
      context: AssetContext;
      patientSessionId?: number | null;
      intakeSessionId?: number | null;
      encounterId?: number | null;
      hospitalId?: number | null;
      createdByUserId?: number;
      createdByPatientId?: number;
    },
    audience: 'patient' | 'staff',
    correlationId?: string,
  ): Promise<AssetSummaryDto[]> {
    this.validateFiles(files);

    const createdAssets: AssetSummaryDto[] = [];

    for (const file of files) {
      const { width, height } = readImageMetadata(file.buffer, file.mimetype);
      const { storageKey, sha256 } = await this.storage.saveImage(file.buffer, {
        bucket: context.context === AssetContext.INTAKE_IMAGE ? 'intake' : 'messages',
        mimeType: file.mimetype,
      });

      try {
        const asset = await this.prisma.asset.create({
          data: {
            context: context.context,
            storageKey,
            originalFilename: file.originalname || 'upload',
            mimeType: file.mimetype,
            sizeBytes: file.size,
            width,
            height,
            sha256,
            patientSessionId: context.patientSessionId ?? null,
            intakeSessionId: context.intakeSessionId ?? null,
            encounterId: context.encounterId ?? null,
            hospitalId: context.hospitalId ?? null,
            createdByUserId: context.createdByUserId,
            createdByPatientId: context.createdByPatientId,
          },
          select: assetSummarySelect,
        });

        createdAssets.push(mapAssetSummary(asset, audience));
      } catch (error) {
        await this.storage.delete(storageKey);
        throw error;
      }
    }

    this.loggingService.info(
      'Uploaded image assets',
      {
        service: 'AssetsService',
        operation: 'persistUploadedImages',
        correlationId,
        encounterId: context.encounterId ?? undefined,
        hospitalId: context.hospitalId ?? undefined,
        patientId: context.createdByPatientId,
        userId: context.createdByUserId,
      },
      {
        assetCount: createdAssets.length,
        assetContext: context.context,
      },
    );

    return createdAssets;
  }

  private validateFiles(files: UploadedImageFile[]): void {
    if (files.length === 0) {
      throw new BadRequestException('At least one image file is required');
    }

    if (files.length > ASSET_MAX_FILES_PER_REQUEST) {
      throw new BadRequestException(`No more than ${ASSET_MAX_FILES_PER_REQUEST} files can be uploaded at once`);
    }

    for (const file of files) {
      if (!ASSET_ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);
      }

      if (!file.size || file.size <= 0) {
        throw new BadRequestException('Image file cannot be empty');
      }

      if (file.size > ASSET_MAX_FILE_SIZE_BYTES) {
        throw new BadRequestException(`Image file exceeds the ${ASSET_MAX_FILE_SIZE_BYTES} byte limit`);
      }
    }
  }

  private buildEtag(assetId: number, updatedAt: Date, sha256?: string | null): string {
    const fingerprint = sha256 ?? `${assetId}-${updatedAt.getTime()}`;
    return `"${fingerprint}"`;
  }
}
