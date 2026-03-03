// backend/src/modules/health/health.controller.ts
// health.controller.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Basic health endpoint: GET /health -> { ok: true }

import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(@Res() response: Response) {
    const readiness = await this.healthService.getReadiness();
    return response.status(readiness.statusCode).json(readiness.payload);
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  async getReadiness(@Res() response: Response) {
    const readiness = await this.healthService.getReadiness();
    return response.status(readiness.statusCode).json(readiness.payload);
  }
}
