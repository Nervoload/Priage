import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';

import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import {
  ASSET_MAX_FILE_SIZE_BYTES,
  ASSET_MAX_FILES_PER_REQUEST,
} from './assets.constants';
import { AssetsService } from './assets.service';

@Controller('patient')
@UseGuards(PatientGuard)
export class PatientAssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('assets/intake/images')
  @UseInterceptors(FilesInterceptor('files', ASSET_MAX_FILES_PER_REQUEST, {
    limits: { fileSize: ASSET_MAX_FILE_SIZE_BYTES },
  }))
  async uploadIntakeImages(
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>,
    @CurrentPatient() patient: PatientContext,
  ) {
    return this.assetsService.uploadIntakeImagesForSession(patient.sessionId, patient.patientId, files ?? []);
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
    @CurrentPatient() patient: PatientContext,
  ) {
    return this.assetsService.uploadMessageImagesForPatient(encounterId, patient.patientId, files ?? []);
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.assetsService.streamAssetForPatient(assetId, patient.patientId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('ETag', file.etag);

    return new StreamableFile(file.stream);
  }
}
