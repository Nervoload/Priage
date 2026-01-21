// backend/src/modules/hospitals/hospitals.controller.ts
// Hospital information and dashboard endpoints

import { Controller, ForbiddenException, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

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
  async getHospital(@Param('id', ParseIntPipe) id: number) {
    return this.hospitalsService.getHospital(id);
  }

  // GET /hospitals/:id/dashboard - Dashboard analytics (ADMIN, NURSE, DOCTOR)
  @Get(':id/dashboard')
  @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR)
  async getDashboard(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    // Ensure user can only access their own hospital
    if (user.hospitalId !== id) {
      throw new ForbiddenException('Cannot access another hospital\'s dashboard');
    }
    return this.hospitalsService.getDashboard(id);
  }

  // GET /hospitals/:id/queue - Queue status (ADMIN, NURSE, DOCTOR, STAFF)
  @Get(':id/queue')
  @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR, Role.STAFF)
  async getQueue(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    if (user.hospitalId !== id) {
      throw new ForbiddenException('Cannot access another hospital\'s queue');
    }
    return this.hospitalsService.getQueueStatus(id);
  }
}
