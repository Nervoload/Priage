// backend/src/modules/intake/intake.controller.ts
// Patient intake endpoints.
// createIntent is public (no auth — this is the entry point for new patients).
// All other endpoints require a valid patient session via PatientGuard.

import { Body, Controller, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import {
  PATIENT_SESSION_COOKIE,
  PATIENT_SESSION_TTL_MS,
  buildAuthCookieOptions,
} from '../../common/http/auth-cookie.util';
import { INTAKE_INTENT_THROTTLE } from '../../common/http/throttle.util';
import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { ConfirmIntentDto } from './dto/confirm-intent.dto';
import { CreateIntentDto } from './dto/create-intent.dto';
import { AdvanceInterviewDto } from './dto/interview.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { UpdateIntakeDetailsDto } from './dto/update-intake-details.dto';
import { IntakeService } from './intake.service';

@Controller('intake')
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

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
    return result;
  }

  /**
   * POST /intake/confirm
   * Requires valid patient session token.
   */
  @Post('confirm')
  @UseGuards(PatientGuard)
  async confirmIntent(
    @Body() dto: ConfirmIntentDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.intakeService.confirmIntentBySession(patient.sessionId, dto, req.correlationId);
  }

  /**
   * PATCH /intake/details
   * Requires valid patient session token.
   */
  @Patch('details')
  @UseGuards(PatientGuard)
  async updateDetails(
    @Body() dto: UpdateIntakeDetailsDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.intakeService.updateDetailsBySession(patient.sessionId, dto, req.correlationId);
  }

  /**
   * POST /intake/interview/start
   * Idempotently starts or resumes the guest interview.
   */
  @Post('interview/start')
  @UseGuards(PatientGuard)
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
  @UseGuards(PatientGuard)
  async advanceInterview(
    @Body() dto: AdvanceInterviewDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.intakeService.advanceInterviewBySession(patient.sessionId, patient.patientId, dto, req.correlationId);
  }

  /**
   * POST /intake/location
   * Requires valid patient session token.
   */
  @Post('location')
  @UseGuards(PatientGuard)
  async recordLocation(
    @Body() dto: LocationPingDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.intakeService.recordLocationBySession(patient.sessionId, dto, req.correlationId);
  }
}
