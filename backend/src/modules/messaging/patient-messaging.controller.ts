// backend/src/modules/messaging/patient-messaging.controller.ts
// Patient-facing messaging endpoints.
// Protected by PatientGuard — patients can only message on their own encounters.

import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientIdempotencyService } from '../auth/patient-idempotency.service';
import { PatientRateLimitGuard } from '../auth/guards/patient-rate-limit.guard';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { CreatePatientMessageDto } from './dto/create-patient-message.dto';
import { ListPatientMessagesQueryDto } from './dto/list-patient-messages.query.dto';
import { MessagingService } from './messaging.service';

@Controller('patient/encounters')
@UseGuards(PatientGuard, PatientRateLimitGuard)
export class PatientMessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly patientIdempotency: PatientIdempotencyService,
  ) {}

  /**
   * GET /patient/encounters/:encounterId/messages
   * List non-internal messages on the patient's own encounter.
   */
  @Get(':encounterId/messages')
  async listMessages(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Query() query: ListPatientMessagesQueryDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.messagingService.listMessagesForPatient(
      encounterId,
      patient.patientId,
      query,
      req.correlationId,
    );
  }

  /**
   * POST /patient/encounters/:encounterId/messages
   * Send a message as a patient on their own encounter.
   */
  @Post(':encounterId/messages')
  async sendMessage(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Body() dto: CreatePatientMessageDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.patientIdempotency.execute(
      {
        patient,
        command: 'patient.message.create',
        idempotencyKey,
        fingerprintInput: { encounterId, body: dto },
        correlationId: req.correlationId,
      },
      () => this.messagingService.createPatientMessage(
        encounterId,
        patient.patientId,
        dto,
        req.correlationId,
      ),
    );
  }
}
