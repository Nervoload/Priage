// backend/src/modules/health/health.controller.ts
// health.controller.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Basic health endpoint: GET /health -> { ok: true }

import { Controller, Get, HttpCode, HttpStatus, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';

import { SkipDemoGate } from '../../common/decorators/skip-demo-gate.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HealthService } from './health.service';

@Controller('health')
@SkipDemoGate()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(@Res() response: Response) {
    const readiness = await this.healthService.getReadiness(false);
    return response.status(readiness.statusCode).json(readiness.payload);
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReadiness(@Res() response: Response) {
    const readiness = await this.healthService.getReadiness(false);
    return response.status(readiness.statusCode).json(readiness.payload);
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getOperationalMetrics(@CurrentUser() user: { hospitalId: number }) {
    return this.healthService.getOperationalMetrics(user.hospitalId);
  }

  @Get('prometheus')
  async getPrometheusMetrics(@Res() response: Response) {
    const metrics = await this.healthService.getPrometheusMetrics();
    return response
      .status(HttpStatus.OK)
      .type('text/plain; version=0.0.4; charset=utf-8')
      .send(metrics);
  }
}
