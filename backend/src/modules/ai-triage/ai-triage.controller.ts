import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientRateLimitGuard } from '../auth/guards/patient-rate-limit.guard';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { PatientIdempotencyService } from '../auth/patient-idempotency.service';
import { AiTriageService } from './ai-triage.service';
import { AnswerTriageDto } from './dto/answer-triage.dto';
import { StartTriageDto } from './dto/start-triage.dto';

@Controller('api/triage')
@UseGuards(PatientGuard, PatientRateLimitGuard)
export class AiTriageController {
  constructor(
    private readonly triage: AiTriageService,
    private readonly idempotency: PatientIdempotencyService,
  ) {}

  @Post('start')
  start(
    @Body() dto: StartTriageDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.triage.start(patient.sessionId, patient.patientId, dto, req.correlationId);
  }

  @Post(':sessionId/answer')
  answer(
    @Param('sessionId') sessionId: string,
    @Body() dto: AnswerTriageDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.idempotency.execute(
      {
        patient,
        command: 'patient.ai-triage.answer',
        idempotencyKey,
        fingerprintInput: { sessionId, body: dto },
        correlationId: req.correlationId,
      },
      () => this.triage.answer(sessionId, patient.sessionId, patient.patientId, dto, req.correlationId),
    );
  }

  @Get(':sessionId')
  get(
    @Param('sessionId') sessionId: string,
    @CurrentPatient() patient: PatientContext,
  ) {
    return this.triage.get(sessionId, patient.sessionId, patient.patientId);
  }

  @Post(':sessionId/complete')
  complete(
    @Param('sessionId') sessionId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.idempotency.execute(
      {
        patient,
        command: 'patient.ai-triage.complete',
        idempotencyKey,
        fingerprintInput: { sessionId },
        correlationId: req.correlationId,
      },
      () => this.triage.complete(sessionId, patient.sessionId, patient.patientId, req.correlationId),
    );
  }
}
