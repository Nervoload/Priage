import {
  Controller,
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
import { Role } from '@prisma/client';
import { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ASSET_MAX_FILE_SIZE_BYTES,
  ASSET_MAX_FILES_PER_REQUEST,
} from './assets.constants';
import { AssetsService } from './assets.service';

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('encounters/:encounterId/message-images')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  @UseInterceptors(FilesInterceptor('files', ASSET_MAX_FILES_PER_REQUEST, {
    limits: { fileSize: ASSET_MAX_FILE_SIZE_BYTES },
  }))
  async uploadMessageImages(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>,
    @CurrentUser() user: { userId: number; hospitalId: number },
  ) {
    return this.assetsService.uploadMessageImagesForStaff(
      encounterId,
      user.hospitalId,
      user.userId,
      files ?? [],
    );
  }

  @Get('encounters/:encounterId')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async listForEncounter(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @CurrentUser() user: { hospitalId: number },
  ) {
    return this.assetsService.listEncounterAssets(encounterId, user.hospitalId);
  }

  @Get(':assetId/content')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async streamStaffAsset(
    @Param('assetId', ParseIntPipe) assetId: number,
    @CurrentUser() user: { hospitalId: number },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.assetsService.streamAssetForStaff(assetId, user.hospitalId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('ETag', file.etag);

    return new StreamableFile(file.stream);
  }
}
