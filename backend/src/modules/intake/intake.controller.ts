// backend/src/modules/intake/intake.controller.ts
// Patient intake endpoints.
// createIntent is public (no auth — this is the entry point for new patients).
// All other endpoints require a valid patient session via PatientGuard.

import { Body, Controller, Headers, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import {
  PATIENT_SESSION_COOKIE,
  PATIENT_SESSION_TTL_MS,
  buildAuthCookieOptions,
} from '../../common/http/auth-cookie.util';
import { INTAKE_INTENT_THROTTLE } from '../../common/http/throttle.util';
import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientIdempotencyService } from '../auth/patient-idempotency.service';
import { PatientRateLimitGuard } from '../auth/guards/patient-rate-limit.guard';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { ConfirmIntentDto } from './dto/confirm-intent.dto';
import { CreateIntentDto } from './dto/create-intent.dto';
import { AdvanceInterviewDto } from './dto/interview.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { UpdateIntakeDetailsDto } from './dto/update-intake-details.dto';
import { IntakeService } from './intake.service';

@Controller('intake')
export class IntakeController {
  constructor(
    private readonly intakeService: IntakeService,
    private readonly patientIdempotency: PatientIdempotencyService,
  ) {}

  /**
   * POST /intake/intent
   * Public endpoint — no auth required.
   * Creates a new patient profile + session token.
   */
  @Post('intent')
  @Throttle(INTAKE_INTENT_THROTTLE)
  async createIntent(
    @Body() dto: CreateIntentDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.intakeService.createIntent(dto, req.correlationId);
    res.cookie(PATIENT_SESSION_COOKIE, result.sessionToken, buildAuthCookieOptions(PATIENT_SESSION_TTL_MS));
    const { sessionToken: _, ...responseBody } = result;
    return responseBody;
  }

  /**
   * POST /intake/confirm
   * Requires valid patient session token.
   */
  @Post('confirm')
  @UseGuards(PatientGuard, PatientRateLimitGuard)
  async confirmIntent(
    @Body() dto: ConfirmIntentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.patientIdempotency.execute(
      {
        patient,
        command: 'patient.intake.confirm',
        idempotencyKey,
        fingerprintInput: { body: dto },
        correlationId: req.correlationId,
      },
      () => this.intakeService.confirmIntentBySession(patient.sessionId, dto, req.correlationId),
    );
  }

  /**
   * PATCH /intake/details
   * Requires valid patient session token.
   */
  @Patch('details')
  @UseGuards(PatientGuard, PatientRateLimitGuard)
  async updateDetails(
    @Body() dto: UpdateIntakeDetailsDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.patientIdempotency.execute(
      {
        patient,
        command: 'patient.intake.details.update',
        idempotencyKey,
        fingerprintInput: { body: dto },
        correlationId: req.correlationId,
      },
      () => this.intakeService.updateDetailsBySession(patient.sessionId, dto, req.correlationId),
    );
  }

  /**
   * POST /intake/interview/start
   * Idempotently starts or resumes the guest interview.
   */
  @Post('interview/start')
  @UseGuards(PatientGuard, PatientRateLimitGuard)
  async startInterview(
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.intakeService.startInterviewBySession(patient.sessionId, patient.patientId, req.correlationId);
  }

  /**
   * POST /intake/interview/advance
   * Persists an answer or emergency acknowledgment and returns the next state.
   */
  @Post('interview/advance')
  @UseGuards(PatientGuard, PatientRateLimitGuard)
  async advanceInterview(
    @Body() dto: AdvanceInterviewDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.patientIdempotency.execute(
      {
        patient,
        command: 'patient.intake.interview.advance',
        idempotencyKey,
        fingerprintInput: { body: dto },
        correlationId: req.correlationId,
      },
      () => this.intakeService.advanceInterviewBySession(patient.sessionId, patient.patientId, dto, req.correlationId),
    );
  }

  /**
   * POST /intake/location
   * Requires valid patient session token.
   */
  @Post('location')
  @UseGuards(PatientGuard, PatientRateLimitGuard)
  async recordLocation(
    @Body() dto: LocationPingDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.intakeService.recordLocationBySession(patient.sessionId, dto, req.correlationId);
  }
}
