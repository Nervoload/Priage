// backend/src/modules/triage/triage.controller.ts
// Triage endpoints.

import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';

import { CreateTriageAssessmentDto } from './dto/create-triage-assessment.dto';
import { TriageService } from './triage.service';

@Controller('triage')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('assessments')
  async createAssessment(@Body() dto: CreateTriageAssessmentDto) {
    return this.triageService.createAssessment(dto);
  }

  @Get('encounters/:encounterId/assessments')
  async listAssessments(@Param('encounterId', ParseIntPipe) encounterId: number) {
    return this.triageService.listAssessments(encounterId);
  }
}
