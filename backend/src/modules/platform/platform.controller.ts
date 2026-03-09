// Partner-facing external API endpoints.
// This controller is separate from first-party patient/staff controllers and
// exists for software integrations that submit intake/context/assets/status.

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import {
  ASSET_MAX_FILE_SIZE_BYTES,
  ASSET_MAX_FILES_PER_REQUEST,
} from '../assets/assets.constants';
import { CurrentPartner } from './decorators/current-partner.decorator';
import { CreateContextItemDto } from './dto/create-context-item.dto';
import { CreatePlatformIntakeSessionDto } from './dto/create-platform-intake-session.dto';
import { ConfirmPlatformIntakeSessionDto } from './dto/confirm-platform-intake-session.dto';
import { PartnerAuthGuard } from './guards/partner-auth.guard';
import { PlatformPartnerContext } from './platform-auth.service';
import { PlatformService } from './platform.service';

@Controller('platform/v1')
@UseGuards(PartnerAuthGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Post('intake-sessions')
  @HttpCode(HttpStatus.CREATED)
  async createIntakeSession(
    @CurrentPartner() partner: PlatformPartnerContext,
    @Body() dto: CreatePlatformIntakeSessionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.platformService.createIntakeSession(partner, dto, idempotencyKey, correlationId);
    res.status(result.statusCode);
    return result.body;
  }

  @Post('intake-sessions/:publicId/context-items')
  @HttpCode(HttpStatus.CREATED)
  async appendContextItem(
    @CurrentPartner() partner: PlatformPartnerContext,
    @Param('publicId') publicId: string,
    @Body() dto: CreateContextItemDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.platformService.appendContextItem(partner, publicId, dto, idempotencyKey, correlationId);
    res.status(result.statusCode);
    return result.body;
  }

  @Post('intake-sessions/:publicId/assets')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', ASSET_MAX_FILES_PER_REQUEST, {
    limits: { fileSize: ASSET_MAX_FILE_SIZE_BYTES },
  }))
  async uploadAssets(
    @CurrentPartner() partner: PlatformPartnerContext,
    @Param('publicId') publicId: string,
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.platformService.uploadAssets(
      partner,
      publicId,
      files ?? [],
      idempotencyKey,
      correlationId,
    );
    res.status(result.statusCode);
    return result.body;
  }

  @Post('intake-sessions/:publicId/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmIntakeSession(
    @CurrentPartner() partner: PlatformPartnerContext,
    @Param('publicId') publicId: string,
    @Body() dto: ConfirmPlatformIntakeSessionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.platformService.confirmIntakeSession(partner, publicId, dto, idempotencyKey, correlationId);
    res.status(result.statusCode);
    return result.body;
  }

  @Post('intake-sessions/:publicId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelIntakeSession(
    @CurrentPartner() partner: PlatformPartnerContext,
    @Param('publicId') publicId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.platformService.cancelIntakeSession(partner, publicId, idempotencyKey, correlationId);
    res.status(result.statusCode);
    return result.body;
  }

  @Get('intake-sessions/:publicId')
  async getIntakeSession(
    @CurrentPartner() partner: PlatformPartnerContext,
    @Param('publicId') publicId: string,
  ) {
    return this.platformService.getIntakeSession(partner, publicId);
  }

  @Get('encounters/:publicId/status')
  async getEncounterStatus(
    @CurrentPartner() partner: PlatformPartnerContext,
    @Param('publicId') publicId: string,
  ) {
    return this.platformService.getEncounterStatus(partner, publicId);
  }
}
