// Priage AI endpoints.
// POST /patient/priage/chat      — send conversation, receive AI response
// POST /patient/priage/admit     — create encounter from AI assessment
// GET  /patient/priage/hospitals  — list available hospitals

import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { PriageService } from './priage.service';
import { PriageChatDto, PriageAdmitDto } from './dto/chat.dto';

@Controller('patient/priage')
@UseGuards(PatientGuard)
export class PriageController {
  constructor(private readonly priageService: PriageService) {}

  @Post('chat')
  async chat(
    @Body() dto: PriageChatDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.priageService.chat(patient.patientId, dto, req.correlationId);
  }

  @Post('admit')
  async admit(
    @Body() dto: PriageAdmitDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.priageService.admit(
      patient.patientId,
      patient.sessionId,
      dto,
      req.correlationId,
    );
  }

  @Get('hospitals')
  async listHospitals() {
    return this.priageService.listHospitals();
  }
}
