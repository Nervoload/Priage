// backend/src/modules/encounters/encounters.service.ts
// encounters.service.ts

// Written by: John Surette
// Date Created: Dec 9 2025
// Last Edited: Jan 6 2026

// Business logic for encounters.
// Writes to Postgres via Prisma and emits real-time events via RealtimeGateway.
// Auth is intentionally skipped; later enforce role rules (admittance vs triage vs waiting staff) here.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EncounterStatus, MessageAuthor } from '../../../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { ListEncountersQueryDto } from './dto/list-encounters.query.dto';

@Injectable()
export class EncountersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async createEncounter(dto: CreateEncounterDto) {

    // Create links Patient + Encounter with PRE_TRIAGE.
    // emit WebSocket event encounter.created to admittance view
    
    // **Prototype: create a new Patient record every time.
    // Later: de-dup patients by phone/email or use an external identity system
    const patient = await this.prisma.patient.create({
      data: {
        displayName: dto.patientDisplayName,
        phone: dto.patientPhone,
      },
    });

    const encounter = await this.prisma.encounter.create({
      data: {
        status: EncounterStatus.PRE_TRIAGE,
        hospitalName: dto.hospitalName,
        chiefComplaint: dto.chiefComplaint,
        details: dto.details,
        patientId: patient.id,
      },
      include: {
        patient: true,
        triageNotes: true,
        messages: true,
      },
    });

    // Push to hospital admittance dashboard (room keyed by hospitalName).
    this.realtime.emitEncounterCreated(encounter.hospitalName, encounter);

    // Also push an "updated" event to the encounter room (if patient has joined it).
    this.realtime.emitEncounterUpdated(encounter.hospitalName, encounter.id, encounter);

    return encounter;
  }

  async listEncounters(query: ListEncountersQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.status) where.status = query.status;
    if (query.hospitalName) where.hospitalName = query.hospitalName;

    return this.prisma.encounter.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        patient: true,
      },
    });
  }

  async getEncounter(encounterId: number) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        patient: true,
        triageNotes: { orderBy: { createdAt: 'asc' } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!encounter) {
      throw new NotFoundException(`Encounter ${encounterId} not found`);
    }

    return encounter;
  }

  async updateEncounterStatus(encounterId: number, status: EncounterStatus) {
    // Optional: enforce allowed transitions here for prototype sanity.
    // checks role: SUPPORT_STAFF can set ARRIVED, CANCELLED, NO_SHOW, etc.
    // MEDICAL-STAFF can set TRIAGE, WAITING, TREATING, OUTBOUND, etc
    // emit WebSocket event encounter.updated 
    
    const current = await this.prisma.encounter.findUnique({ where: { id: encounterId } });
    if (!current) throw new NotFoundException(`Encounter ${encounterId} not found`);

    // Minimal transition sanity check: don't change after COMPLETE/CANCELLED.
    if (
      current.status === EncounterStatus.COMPLETE ||
      current.status === EncounterStatus.CANCELLED
    ) {
      throw new BadRequestException(`Encounter ${encounterId} is terminal (${current.status})`);
    }


    const updated = await this.prisma.encounter.update({
      where: { id: encounterId },
      data: { status },
      include: {
        patient: true,
        triageNotes: true,
        messages: true,
      },
    });

    this.realtime.emitEncounterUpdated(updated.hospitalName, updated.id, updated);
    return updated;
  }

  async addTriageNote(encounterId: number, note: string) {
    // Ensure encounter exists and capture hospitalName for broadcast.
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { id: true, hospitalName: true },
    });
    if (!encounter) throw new NotFoundException(`Encounter ${encounterId} not found`);

    const triageNote = await this.prisma.triageNote.create({
      data: {
        note,
        encounterId,
      },
    });

    this.realtime.emitTriageNoteCreated(encounter.hospitalName, encounterId, triageNote);

    // Emit updated encounter snapshot as well (handy for UIs).
    const updated = await this.getEncounter(encounterId);
    this.realtime.emitEncounterUpdated(encounter.hospitalName, encounterId, updated);

    return triageNote;
  }

  async addMessage(encounterId: number, from: MessageAuthor, content: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { id: true, hospitalName: true },
    });
    if (!encounter) throw new NotFoundException(`Encounter ${encounterId} not found`);

    const message = await this.prisma.message.create({
      data: {
        from,
        content,
        encounterId,
      },
    });

    this.realtime.emitMessageCreated(encounter.hospitalName, encounterId, message);

    // Emit updated encounter snapshot (optional but convenient).
    const updated = await this.getEncounter(encounterId);
    this.realtime.emitEncounterUpdated(encounter.hospitalName, encounterId, updated);

    return message;
  }
}
