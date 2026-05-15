// backend/src/modules/hospitals/hospitals.controller.ts
// Hospital information and dashboard endpoints

import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateFeedbackSubmissionDto } from './dto/create-feedback-submission.dto';
import { UpdateHospitalConfigDto } from './dto/update-hospital-config.dto';
import { UpdateHospitalDetailsDto } from './dto/update-hospital-details.dto';
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

  @Patch(':id')
  @Roles(Role.ADMIN)
  async updateHospital(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHospitalDetailsDto,
    @CurrentUser() user: { userId: number; hospitalId: number },
  ) {
    if (user.hospitalId !== id) {
      throw new ForbiddenException('Cannot update another hospital');
    }
    return this.hospitalsService.updateHospitalDetails(
      id,
      user.userId,
      dto,
      req.correlationId,
    );
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

  @Get(':id/config')
  async getConfig(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { hospitalId: number },
  ) {
    if (user.hospitalId !== id) {
      throw new ForbiddenException('Cannot access another hospital\'s configuration');
    }
    return this.hospitalsService.getConfig(id, req.correlationId);
  }

  @Put(':id/config')
  @Roles(Role.ADMIN)
  async updateConfig(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHospitalConfigDto,
    @CurrentUser() user: { hospitalId: number },
  ) {
    if (user.hospitalId !== id) {
      throw new ForbiddenException('Cannot update another hospital\'s configuration');
    }
    return this.hospitalsService.updateConfig(id, dto, req.correlationId);
  }

  @Get(':id/feedback')
  @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR)
  async listAdmittanceFeedback(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { hospitalId: number },
    @Query('limit') limit?: number,
  ) {
    if (user.hospitalId !== id) {
      throw new ForbiddenException('Cannot access another hospital\'s feedback');
    }
    return this.hospitalsService.listAdmittanceFeedback(id, limit, req.correlationId);
  }

  @Post(':id/feedback')
  @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR, Role.STAFF)
  async submitAdmittanceFeedback(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFeedbackSubmissionDto,
    @CurrentUser() user: { userId: number; email: string; role: Role; hospitalId: number },
  ) {
    if (user.hospitalId !== id) {
      throw new ForbiddenException('Cannot submit feedback for another hospital');
    }
    return this.hospitalsService.submitAdmittanceFeedback(
      id,
      {
        userId: user.userId,
        email: user.email,
        role: user.role,
      },
      dto,
      req.correlationId,
    );
  }
}
