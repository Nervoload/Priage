// backend/src/modules/analytics/analytics.controller.ts
// Analytics REST endpoints.

import { Controller, ForbiddenException, Get, Param, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GetHospitalAnalyticsQueryDto } from './dto/get-hospital-analytics.query.dto';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('hospitals/:id/encounters')
  @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR)
  async getHospitalEncounterAnalytics(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetHospitalAnalyticsQueryDto,
    @CurrentUser() user: { userId: number; hospitalId: number; role: Role },
  ) {
    if (user.hospitalId !== id) {
      throw new ForbiddenException('Cannot access another hospital\'s analytics');
    }

    const effectiveQuery = {
      ...query,
      range: user.role === Role.ADMIN ? query.range : 'week',
    } satisfies GetHospitalAnalyticsQueryDto;

    return this.analyticsService.getHospitalAnalytics(id, effectiveQuery, req.correlationId);
  }
}
