// backend/src/modules/assets/assets.controller.ts
// Asset endpoints (metadata + dev upload stubs).

import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async create(@Body() dto: CreateAssetDto, @CurrentUser() user: { hospitalId: number }) {
    return this.assetsService.createAsset(dto, user.hospitalId);
  }

  @Get('encounters/:encounterId')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async listForEncounter(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @CurrentUser() user: { hospitalId: number },
  ) {
    return this.assetsService.listAssets(encounterId, user.hospitalId);
  }

  @Post(':id/upload')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async upload(@Param('id', ParseIntPipe) id: number) {
    return { ok: true, assetId: id };
  }
}
