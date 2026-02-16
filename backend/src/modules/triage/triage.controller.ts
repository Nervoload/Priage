// backend/src/modules/triage/triage.controller.ts
// Triage endpoints.

import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTriageAssessmentDto } from './dto/create-triage-assessment.dto';
import { TriageService } from './triage.service';

@Controller('triage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('assessments')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async createAssessment(
    @Body() dto: CreateTriageAssessmentDto,
    @Req() req: Request,
    @CurrentUser() user: { userId: number; hospitalId: number },
  ) {
    return this.triageService.createAssessment(dto, user.hospitalId, user.userId, req.correlationId);
  }

  @Get('assessments/:id')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async getAssessment(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @CurrentUser() user: { userId: number; hospitalId: number },
  ) {
    return this.triageService.getAssessment(id, user.hospitalId, req.correlationId);
  }

  @Get('encounters/:encounterId/assessments')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async listAssessments(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Req() req: Request,
    @CurrentUser() user: { userId: number; hospitalId: number },
  ) {
    return this.triageService.listAssessments(encounterId, user.hospitalId, req.correlationId);
  }

  // Phase 6.5: Add an AI triage suggestion endpoint here:
  //   @Post('encounters/:encounterId/suggest')
  //   @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  //   async suggestTriage(@Param('encounterId') encounterId: number, @CurrentUser() user)
  // This endpoint would analyze the encounter's chief complaint, vital signs,
  // and patient demographics to return a suggested CTAS level, pain level,
  // and reasoning string. The frontend TriageForm would call this via an
  // "AI Suggest" button and pre-fill form fields with the response.
}
