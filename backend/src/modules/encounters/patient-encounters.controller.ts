// backend/src/modules/encounters/patient-encounters.controller.ts
// Patient-facing encounter endpoints.
// Protected by PatientGuard — only the patient who owns the encounter can access it.

import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { EncountersService } from './encounters.service';

@Controller('patient/encounters')
@UseGuards(PatientGuard)
export class PatientEncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  /**
   * GET /patient/encounters
   * List all encounters belonging to the authenticated patient.
   */
  @Get()
  async listOwn(
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.encountersService.listEncountersForPatient(
      patient.patientId,
      req.correlationId,
    );
  }

  /**
   * GET /patient/encounters/:id
   * Get a specific encounter belonging to the authenticated patient.
   * Returns limited data — no triage, no internal messages, no alerts.
   */
  @Get(':id')
  async getOwn(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.encountersService.getEncounterForPatient(
      patient.patientId,
      id,
      patient.hospitalId,
      req.correlationId,
    );
  }

  /**
   * GET /patient/encounters/:id/queue
   * Get estimated queue position and wait time for the patient's encounter.
   */
  @Get(':id/queue')
  async getQueuePosition(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    if (!patient.hospitalId) {
      return { position: 0, estimatedMinutes: 0, totalInQueue: 0 };
    }
    return this.encountersService.getQueuePosition(
      id,
      patient.hospitalId,
      req.correlationId,
    );
  }
}
