// backend/src/modules/messaging/patient-messaging.controller.ts
// Patient-facing messaging endpoints.
// Protected by PatientGuard — patients can only message on their own encounters.

import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { CreatePatientMessageDto } from './dto/create-patient-message.dto';
import { MessagingService } from './messaging.service';

@Controller('patient/encounters')
@UseGuards(PatientGuard)
export class PatientMessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  /**
   * GET /patient/encounters/:encounterId/messages
   * List non-internal messages on the patient's own encounter.
   */
  @Get(':encounterId/messages')
  async listMessages(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.messagingService.listMessagesForPatient(
      encounterId,
      patient.patientId,
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
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.messagingService.createPatientMessage(
      encounterId,
      patient.patientId,
      dto,
      req.correlationId,
    );
  }
}
