// backend/src/modules/alerts/alerts.controller.ts
// Alerts REST endpoints.

import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AlertsService } from './alerts.service';
import { AckAlertDto } from './dto/ack-alert.dto';
import { CreateAlertDto } from './dto/create-alert.dto';
import { ResolveAlertDto } from './dto/resolve-alert.dto';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async create(@Body() dto: CreateAlertDto, @Req() req: Request) {
    return this.alertsService.createAlert(dto, req.correlationId);
  }

  @Post(':id/acknowledge')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async acknowledge(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AckAlertDto,
    @Req() req: Request,
  ) {
    return this.alertsService.acknowledgeAlert(id, dto.actorUserId, req.correlationId);
  }

  @Post(':id/resolve')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveAlertDto,
    @Req() req: Request,
  ) {
    return this.alertsService.resolveAlert(id, dto.actorUserId, req.correlationId);
  }

  @Get('hospitals/:hospitalId/unacknowledged')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async listUnacknowledged(@Param('hospitalId', ParseIntPipe) hospitalId: number, @Req() req: Request) {
    return this.alertsService.listUnacknowledgedAlerts(hospitalId, req.correlationId);
  }

  @Get('encounters/:encounterId')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async listForEncounter(@Param('encounterId', ParseIntPipe) encounterId: number, @Req() req: Request) {
    return this.alertsService.listAlertsForEncounter(encounterId, req.correlationId);
  }
}
