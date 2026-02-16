// backend/src/modules/hospitals/hospitals.controller.ts
// Hospital information and dashboard endpoints

import { Controller, ForbiddenException, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HospitalsService } from './hospitals.service';

@Controller('hospitals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  // GET /hospitals/:id - Get hospital info (all authenticated users)
  @Get(':id')
  async getHospital(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number; hospitalId: number },
  ) {
    if (user.hospitalId !== id) {
      throw new ForbiddenException('Cannot access another hospital');
    }
    return this.hospitalsService.getHospital(id, req.correlationId);
  }

  // GET /hospitals/:id/dashboard - Dashboard analytics (ADMIN, NURSE, DOCTOR)
  @Get(':id/dashboard')
  @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR)
  async getDashboard(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    // Ensure user can only access their own hospital
    if (user.hospitalId !== id) {
      throw new ForbiddenException('Cannot access another hospital\'s dashboard');
    }
    return this.hospitalsService.getDashboard(id, req.correlationId);
  }

  // GET /hospitals/:id/queue - Queue status (ADMIN, NURSE, DOCTOR, STAFF)
  @Get(':id/queue')
  @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR, Role.STAFF)
  async getQueue(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    if (user.hospitalId !== id) {
      throw new ForbiddenException('Cannot access another hospital\'s queue');
    }
    return this.hospitalsService.getQueueStatus(id, req.correlationId);
  }
}
