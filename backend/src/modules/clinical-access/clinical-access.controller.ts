import { Body, Controller, Delete, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClinicalAccessService, StaffClinicalContext } from './clinical-access.service';
import { BreakGlassDto, GrantEncounterAccessDto } from './dto/clinical-access.dto';

@Controller('clinical-access/encounters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClinicalAccessController {
  constructor(private readonly clinicalAccess: ClinicalAccessService) {}

  @Post(':encounterId/assign')
  @Roles(Role.ADMIN)
  grant(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Body() dto: GrantEncounterAccessDto,
    @CurrentUser() user: StaffClinicalContext,
  ) {
    return this.clinicalAccess.grantEncounterAccess(user, encounterId, dto);
  }

  @Delete(':encounterId/assign/:userId')
  @Roles(Role.ADMIN)
  revoke(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: StaffClinicalContext,
  ) {
    return this.clinicalAccess.revokeEncounterAccess(user, encounterId, userId);
  }

  @Post(':encounterId/break-glass')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  createBreakGlass(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Body() dto: BreakGlassDto,
    @CurrentUser() user: StaffClinicalContext,
    @Req() req: Request,
  ) {
    return this.clinicalAccess.createBreakGlassAccess(user, encounterId, dto, req.correlationId);
  }
}
