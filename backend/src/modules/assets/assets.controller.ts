import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
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
import { ClinicalAccessService } from '../clinical-access/clinical-access.service';

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly clinicalAccess: ClinicalAccessService,
  ) {}

  @Post('encounters/:encounterId/message-images')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  @UseInterceptors(FilesInterceptor('files', ASSET_MAX_FILES_PER_REQUEST, {
    limits: { fileSize: ASSET_MAX_FILE_SIZE_BYTES },
  }))
  async uploadMessageImages(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>,
    @CurrentUser() user: { userId: number; hospitalId: number; role: Role },
  ) {
    await this.clinicalAccess.assertClinicalEncounterAccess(user, encounterId);
    return this.assetsService.uploadMessageImagesForStaff(
      encounterId,
      user.hospitalId,
      user.userId,
      files ?? [],
    );
  }

  @Get('encounters/:encounterId')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async listForEncounter(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Req() req: Request,
    @CurrentUser() user: { userId: number; hospitalId: number; role: Role },
  ) {
    await this.clinicalAccess.assertClinicalEncounterAccess(user, encounterId);
    return this.assetsService.listEncounterAssets(
      encounterId,
      user.hospitalId,
      user.userId,
      req.correlationId,
    );
  }

  @Get(':assetId/content')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async streamStaffAsset(
    @Param('assetId', ParseIntPipe) assetId: number,
    @CurrentUser() user: { userId: number; hospitalId: number; role: Role },
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.clinicalAccess.assertClinicalAssetAccess(user, assetId);
    const file = await this.assetsService.streamAssetForStaff(
      assetId,
      user.hospitalId,
      user.userId,
      req.correlationId,
    );

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('ETag', file.etag);

    if (file.kind === 'redirect') {
      res.redirect(302, file.url);
      return;
    }

    file.stream.pipe(res);
  }
}
