// Priage AI endpoints.
// POST /patient/priage/chat      — send conversation, receive AI response
// POST /patient/priage/admit     — create encounter from AI assessment
// GET  /patient/priage/hospitals  — list available hospitals

import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientIdempotencyService } from '../auth/patient-idempotency.service';
import { PatientRateLimitGuard } from '../auth/guards/patient-rate-limit.guard';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { PriageService } from './priage.service';
import { PriageChatDto, PriageAdmitDto } from './dto/chat.dto';

@Controller('patient/priage')
export class PriageController {
  constructor(
    private readonly priageService: PriageService,
    private readonly patientIdempotency: PatientIdempotencyService,
  ) {}

  @Post('chat')
  @UseGuards(PatientGuard, PatientRateLimitGuard)
  async chat(
    @Body() dto: PriageChatDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.priageService.chat(patient.patientId, dto, req.correlationId);
  }

  @Post('admit')
  @UseGuards(PatientGuard, PatientRateLimitGuard)
  async admit(
    @Body() dto: PriageAdmitDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.patientIdempotency.execute(
      {
        patient,
        command: 'patient.priage.admit',
        idempotencyKey,
        fingerprintInput: { body: dto },
        correlationId: req.correlationId,
      },
      () => this.priageService.admit(
        patient.patientId,
        patient.sessionId,
        dto,
        req.correlationId,
      ),
    );
  }

  @Get('hospitals')
  async listHospitals() {
    return this.priageService.listHospitals();
  }
}
