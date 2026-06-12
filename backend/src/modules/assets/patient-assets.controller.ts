import {
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { Request } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { createHash } from 'crypto';

import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientRateLimitGuard } from '../auth/guards/patient-rate-limit.guard';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { PatientIdempotencyService } from '../auth/patient-idempotency.service';
import {
  ASSET_MAX_FILE_SIZE_BYTES,
  ASSET_MAX_FILES_PER_REQUEST,
} from './assets.constants';
import { AssetsService } from './assets.service';

@Controller('patient')
@UseGuards(PatientGuard, PatientRateLimitGuard)
export class PatientAssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly patientIdempotency: PatientIdempotencyService,
  ) {}

  @Post('assets/intake/images')
  @UseInterceptors(FilesInterceptor('files', ASSET_MAX_FILES_PER_REQUEST, {
    limits: { fileSize: ASSET_MAX_FILE_SIZE_BYTES },
  }))
  async uploadIntakeImages(
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.patientIdempotency.execute(
      {
        patient,
        command: 'patient.asset.intake.upload',
        idempotencyKey,
        fingerprintInput: { files: this.fileFingerprints(files ?? []) },
        correlationId: req.correlationId,
      },
      () => this.assetsService.uploadIntakeImagesForSession(patient.sessionId, patient.patientId, files ?? []),
    );
  }

  @Get('assets/intake/images')
  async listIntakeImages(@CurrentPatient() patient: PatientContext) {
    return this.assetsService.listIntakeImagesForSession(patient.sessionId, patient.patientId);
  }

  @Post('encounters/:encounterId/message-images')
  @UseInterceptors(FilesInterceptor('files', ASSET_MAX_FILES_PER_REQUEST, {
    limits: { fileSize: ASSET_MAX_FILE_SIZE_BYTES },
  }))
  async uploadMessageImages(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.patientIdempotency.execute(
      {
        patient,
        command: 'patient.asset.message.upload',
        idempotencyKey,
        fingerprintInput: { encounterId, files: this.fileFingerprints(files ?? []) },
        correlationId: req.correlationId,
      },
      () => this.assetsService.uploadMessageImagesForPatient(encounterId, patient.patientId, files ?? []),
    );
  }

  @Delete('assets/:assetId')
  async deleteAsset(
    @Param('assetId', ParseIntPipe) assetId: number,
    @CurrentPatient() patient: PatientContext,
  ) {
    return this.assetsService.deleteAssetForPatient(assetId, patient.patientId);
  }

  @Get('assets/:assetId/content')
  async streamPatientAsset(
    @Param('assetId', ParseIntPipe) assetId: number,
    @CurrentPatient() patient: PatientContext,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.assetsService.streamAssetForPatient(assetId, patient.patientId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('ETag', file.etag);

    if (file.kind === 'redirect') {
      res.redirect(302, file.url);
      return;
    }

    file.stream.pipe(res);
  }

  private fileFingerprints(files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>) {
    return files.map((file) => ({
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
    }));
  }
}
