// backend/src/modules/encounters/patient-encounters.controller.ts
// Patient-facing encounter endpoints.
// Protected by PatientGuard — only the patient who owns the encounter can access it.

import { Controller, Get, Headers, HttpException, HttpStatus, MessageEvent, Param, ParseIntPipe, Post, Req, Sse, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { Observable, finalize, interval, map, merge, tap } from 'rxjs';

import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientIdempotencyService } from '../auth/patient-idempotency.service';
import { PatientRateLimitGuard } from '../auth/guards/patient-rate-limit.guard';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { EventsService } from '../events/events.service';
import { PatientRealtimeService } from '../events/patient-realtime.service';
import { EncountersService } from './encounters.service';

@Controller('patient/encounters')
@UseGuards(PatientGuard, PatientRateLimitGuard)
export class PatientEncountersController {
  constructor(
    private readonly encountersService: EncountersService,
    private readonly patientIdempotency: PatientIdempotencyService,
    private readonly eventsService: EventsService,
    private readonly patientRealtime: PatientRealtimeService,
  ) {}

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
    return this.encountersService.getQueuePositionForPatient(
      patient.patientId,
      id,
      patient.hospitalId,
      req.correlationId,
    );
  }

  /**
   * GET /patient/encounters/:id/events
   * Server-sent event stream for a patient's own encounter updates.
   */
  @Sse(':id/events')
  async streamOwnEvents(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPatient() patient: PatientContext,
  ): Promise<Observable<MessageEvent>> {
    await this.encountersService.assertPatientOwnsEncounter(patient.patientId, id);
    const connectionId = randomUUID();
    if (!await this.patientRealtime.reservePatientConnection(patient.patientId, connectionId)) {
      throw new HttpException('Patient realtime connection limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }

    const eventStream = this.eventsService.observeEncounterEvents(id).pipe(
      map((event): MessageEvent => ({
        id: String(event.id),
        type: this.toPatientEventType(event.type),
        data: {
          eventId: event.id,
          encounterId: event.encounterId,
          createdAt: event.createdAt,
          metadata: this.toPatientEventMetadata(event.type, event.metadata),
        },
      })),
    );
    const keepAlive = interval(25_000).pipe(
      tap(() => {
        void this.patientRealtime.touchPatientConnection(patient.patientId, connectionId).catch(() => undefined);
      }),
      map((): MessageEvent => ({
        type: 'keepalive',
        data: { ok: true },
      })),
    );

    return merge(eventStream, keepAlive).pipe(
      finalize(() => {
        void this.patientRealtime.releasePatientConnection(patient.patientId, connectionId).catch(() => undefined);
      }),
    );
  }

  /**
   * POST /patient/encounters/:id/cancel
   * Cancel the patient's own encounter (demo restart / self-cancel flow).
   */
  @Post(':id/cancel')
  async cancelOwn(
    @Param('id', ParseIntPipe) id: number,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.patientIdempotency.execute(
      {
        patient,
        command: 'patient.encounter.cancel',
        idempotencyKey,
        fingerprintInput: { encounterId: id },
        correlationId: req.correlationId,
      },
      () => this.encountersService.cancelEncounterForPatient(
        patient.patientId,
        id,
        patient.hospitalId,
        req.correlationId,
      ),
    );
  }

  private toPatientEventType(type: string): string {
    switch (type) {
      case 'MESSAGE_CREATED':
        return 'message.created';
      case 'STATUS_CHANGE':
      case 'TRIAGE_CREATED':
      case 'TRIAGE_COMPLETED':
      case 'ENCOUNTER_CREATED':
        return 'encounter.updated';
      default:
        return 'encounter.event';
    }
  }

  private toPatientEventMetadata(type: string, rawMetadata: unknown): Record<string, unknown> {
    if (type !== 'STATUS_CHANGE' && type !== 'ENCOUNTER_CREATED') {
      return {};
    }
    const metadata = rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)
      ? rawMetadata as Record<string, unknown>
      : {};
    return {
      status: metadata.status,
      fromStatus: metadata.fromStatus,
      toStatus: metadata.toStatus,
      transition: metadata.transition,
    };
  }
}
