// backend/src/modules/alerts/alerts.controller.ts
// Alerts REST endpoints.

import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';

import { AlertsService } from './alerts.service';
import { AckAlertDto } from './dto/ack-alert.dto';
import { CreateAlertDto } from './dto/create-alert.dto';
import { ResolveAlertDto } from './dto/resolve-alert.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  async create(@Body() dto: CreateAlertDto) {
    return this.alertsService.createAlert(dto);
  }

  @Post(':id/acknowledge')
  async acknowledge(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AckAlertDto,
  ) {
    return this.alertsService.acknowledgeAlert(id, dto.actorUserId);
  }

  @Post(':id/resolve')
  async resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveAlertDto,
  ) {
    return this.alertsService.resolveAlert(id, dto.actorUserId);
  }

  @Get('hospitals/:hospitalId/unacknowledged')
  async listUnacknowledged(@Param('hospitalId', ParseIntPipe) hospitalId: number) {
    return this.alertsService.listUnacknowledgedAlerts(hospitalId);
  }

  @Get('encounters/:encounterId')
  async listForEncounter(@Param('encounterId', ParseIntPipe) encounterId: number) {
    return this.alertsService.listAlertsForEncounter(encounterId);
  }
}
