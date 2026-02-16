// backend/src/modules/intake/intake.controller.ts
// Patient intake endpoints.
// createIntent is public (no auth — this is the entry point for new patients).
// All other endpoints require a valid patient session via PatientGuard.

import { Body, Controller, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { ConfirmIntentDto } from './dto/confirm-intent.dto';
import { CreateIntentDto } from './dto/create-intent.dto';
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
  async createIntent(@Body() dto: CreateIntentDto, @Req() req: Request) {
    return this.intakeService.createIntent(dto, req.correlationId);
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
