// backend/src/modules/alerts/alerts.controller.ts
// Alerts REST endpoints.

import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClinicalAccessService } from '../clinical-access/clinical-access.service';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly clinicalAccess: ClinicalAccessService,
  ) {}

  @Post()
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async create(
    @Body() dto: CreateAlertDto,
    @Req() req: Request,
    @CurrentUser() user: { userId: number; hospitalId: number; role: Role },
  ) {
    await this.clinicalAccess.assertClinicalEncounterAccess(user, dto.encounterId);
    return this.alertsService.createAlert(dto, user.hospitalId, user.userId, req.correlationId);
  }

  @Post(':id/acknowledge')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async acknowledge(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @CurrentUser() user: { userId: number; hospitalId: number; role: Role },
  ) {
    await this.clinicalAccess.assertClinicalAlertAccess(user, id);
    return this.alertsService.acknowledgeAlert(id, user.hospitalId, user.userId, req.correlationId);
  }

  @Post(':id/resolve')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async resolve(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @CurrentUser() user: { userId: number; hospitalId: number; role: Role },
  ) {
    await this.clinicalAccess.assertClinicalAlertAccess(user, id);
    return this.alertsService.resolveAlert(id, user.hospitalId, user.userId, req.correlationId);
  }

  @Get('hospitals/:hospitalId/unacknowledged')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async listUnacknowledged(
    @Param('hospitalId', ParseIntPipe) hospitalId: number,
    @Req() req: Request,
    @CurrentUser() user: { userId: number; hospitalId: number; role: Role },
  ) {
    if (hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Cannot access another hospital\'s alerts');
    }
    const encounterScope = await this.clinicalAccess.getClinicalEncounterScope(user);
    return this.alertsService.listUnacknowledgedAlerts(
      user.hospitalId,
      req.correlationId,
      encounterScope,
      user.userId,
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
    return this.alertsService.listAlertsForEncounter(
      encounterId,
      user.hospitalId,
      req.correlationId,
      user.userId,
    );
  }
}
