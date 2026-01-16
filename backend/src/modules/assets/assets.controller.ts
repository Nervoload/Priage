// backend/src/modules/assets/assets.controller.ts
// Asset endpoints (metadata + dev upload stubs).

import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';

import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  async create(@Body() dto: CreateAssetDto) {
    return this.assetsService.createAsset(dto);
  }

  @Get('encounters/:encounterId')
  async listForEncounter(@Param('encounterId', ParseIntPipe) encounterId: number) {
    return this.assetsService.listAssets(encounterId);
  }

  @Post(':id/upload')
  async upload(@Param('id', ParseIntPipe) id: number) {
    return { ok: true, assetId: id };
  }
}
