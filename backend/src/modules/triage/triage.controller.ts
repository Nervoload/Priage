// backend/src/modules/triage/triage.controller.ts
// Triage endpoints.

import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';

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
  async createAssessment(@Body() dto: CreateTriageAssessmentDto, @Req() req: Request) {
    return this.triageService.createAssessment(dto, req.correlationId);
  }

  @Get('encounters/:encounterId/assessments')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async listAssessments(@Param('encounterId', ParseIntPipe) encounterId: number, @Req() req: Request) {
    return this.triageService.listAssessments(encounterId, req.correlationId);
  }
}
