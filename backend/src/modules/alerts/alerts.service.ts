// backend/src/modules/alerts/alerts.service.ts
// Alerts service for safety escalations.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertSeverity, EventType, Prisma } from '@prisma/client';

import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';

export type CreateAlertTxArgs = {
  encounterId: number;
  hospitalId?: number;
  type: string;
  severity?: AlertSeverity | keyof typeof AlertSeverity;
  metadata?: Prisma.InputJsonValue;
  actor?: {
    actorUserId?: number;
    actorPatientId?: number;
  };
};

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async createAlert(dto: CreateAlertDto) {
    const { alert, event } = await this.prisma.$transaction(async (tx) => {
      const encounter = await tx.encounter.findUnique({
        where: { id: dto.encounterId },
        select: { hospitalId: true },
      });
      if (!encounter || encounter.hospitalId !== dto.hospitalId) {
        throw new NotFoundException('Encounter does not belong to hospital');
      }

      const created = await this.createAlertTx(tx, {
        encounterId: dto.encounterId,
        hospitalId: dto.hospitalId,
        type: dto.type,
        severity: dto.severity,
        // metadata: dto.metadata -- raised an error!
        actor: { actorUserId: dto.actorUserId },
      });

      return { alert: created.alert, event: created.event };
    });

    if (event) {
      this.events.dispatchEncounterEvent(event);
    }

    return alert;
  }

  async createAlertTx(tx: Prisma.TransactionClient, args: CreateAlertTxArgs) {
    if (!args.hospitalId) {
      throw new BadRequestException('hospitalId is required to create alerts');
    }

    const created = await tx.alert.create({
      data: {
        encounterId: args.encounterId,
        hospitalId: args.hospitalId,
        type: args.type,
        severity: args.severity ? AlertSeverity[args.severity as keyof typeof AlertSeverity] : undefined,
        metadata: args.metadata,
      },
    });

    const createdEvent = await this.events.emitEncounterEventTx(tx, {
      encounterId: created.encounterId,
      hospitalId: created.hospitalId,
      type: EventType.ALERT_CREATED,
      metadata: {
        alertId: created.id,
        type: created.type,
        severity: created.severity,
      },
      actor: args.actor,
    });

    return { alert: created, event: createdEvent };
  }

  async acknowledgeAlert(alertId: number, actorUserId: number) {
    const { alert, event } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.alert.findUnique({ where: { id: alertId } });
      if (!existing) throw new NotFoundException(`Alert ${alertId} not found`);
      if (existing.acknowledgedAt) {
        throw new BadRequestException(`Alert ${alertId} already acknowledged`);
      }

      const updated = await tx.alert.update({
        where: { id: alertId },
        data: {
          acknowledgedAt: new Date(),
          acknowledgedByUserId: actorUserId,
        },
      });

      const createdEvent = await this.events.emitEncounterEventTx(tx, {
        encounterId: updated.encounterId,
        hospitalId: updated.hospitalId,
        type: EventType.ALERT_ACKNOWLEDGED,
        metadata: {
          alertId: updated.id,
          acknowledgedAt: updated.acknowledgedAt,
        },
        actor: { actorUserId },
      });

      return { alert: updated, event: createdEvent };
    });

    if (event) {
      this.events.dispatchEncounterEvent(event);
    }

    return alert;
  }

  async resolveAlert(alertId: number, actorUserId: number) {
    const { alert, event } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.alert.findUnique({ where: { id: alertId } });
      if (!existing) throw new NotFoundException(`Alert ${alertId} not found`);
      if (existing.resolvedAt) {
        throw new BadRequestException(`Alert ${alertId} already resolved`);
      }

      const updated = await tx.alert.update({
        where: { id: alertId },
        data: {
          resolvedAt: new Date(),
          resolvedByUserId: actorUserId,
        },
      });

      const createdEvent = await this.events.emitEncounterEventTx(tx, {
        encounterId: updated.encounterId,
        hospitalId: updated.hospitalId,
        type: EventType.ALERT_RESOLVED,
        metadata: {
          alertId: updated.id,
          resolvedAt: updated.resolvedAt,
        },
        actor: { actorUserId },
      });

      return { alert: updated, event: createdEvent };
    });

    if (event) {
      this.events.dispatchEncounterEvent(event);
    }

    return alert;
  }

  async listUnacknowledgedAlerts(hospitalId: number) {
    return this.prisma.alert.findMany({
      where: { hospitalId, acknowledgedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAlertsForEncounter(encounterId: number) {
    return this.prisma.alert.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
