// backend/src/modules/alerts/alerts.service.ts
// Alerts service for safety escalations.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {
    this.logger.log('AlertsService initialized');
  }

  async createAlert(dto: CreateAlertDto) {
    const logContext = {
      encounterId: dto.encounterId,
      hospitalId: dto.hospitalId,
      alertType: dto.type,
      severity: dto.severity,
      actorUserId: dto.actorUserId,
    };

    this.logger.log({
      message: 'Creating alert',
      ...logContext,
    });

    try {
      const { alert, event } = await this.prisma.$transaction(async (tx) => {
        const encounter = await tx.encounter.findUnique({
          where: { id: dto.encounterId },
          select: { hospitalId: true },
        });
        if (!encounter || encounter.hospitalId !== dto.hospitalId) {
          this.logger.warn({
            message: 'Alert creation rejected: Encounter not found or hospital mismatch',
            ...logContext,
          });
          throw new NotFoundException('Encounter does not belong to hospital');
        }

        const created = await this.createAlertTx(tx, {
          encounterId: dto.encounterId,
          hospitalId: dto.hospitalId,
          type: dto.type,
          severity: dto.severity,
          actor: { actorUserId: dto.actorUserId },
        });

        return { alert: created.alert, event: created.event };
      });

      this.logger.log({
        message: 'Alert created successfully',
        alertId: alert.id,
        eventId: event?.id,
        ...logContext,
      });

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return alert;
    } catch (error) {
      this.logger.error({
        message: 'Failed to create alert',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...logContext,
      });
      throw error;
    }
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
    this.logger.log({
      message: 'Acknowledging alert',
      alertId,
      actorUserId,
    });

    try {
      const { alert, event } = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.alert.findUnique({ where: { id: alertId } });
        if (!existing) {
          this.logger.warn({
            message: 'Alert not found for acknowledgement',
            alertId,
          });
          throw new NotFoundException(`Alert ${alertId} not found`);
        }
        if (existing.acknowledgedAt) {
          this.logger.warn({
            message: 'Alert already acknowledged',
            alertId,
            acknowledgedAt: existing.acknowledgedAt,
          });
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

      this.logger.log({
        message: 'Alert acknowledged successfully',
        alertId,
        actorUserId,
        encounterId: alert.encounterId,
        eventId: event?.id,
      });

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return alert;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error({
        message: 'Failed to acknowledge alert',
        alertId,
        actorUserId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async resolveAlert(alertId: number, actorUserId: number) {
    this.logger.log({
      message: 'Resolving alert',
      alertId,
      actorUserId,
    });

    try {
      const { alert, event } = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.alert.findUnique({ where: { id: alertId } });
        if (!existing) {
          this.logger.warn({
            message: 'Alert not found for resolution',
            alertId,
          });
          throw new NotFoundException(`Alert ${alertId} not found`);
        }
        if (existing.resolvedAt) {
          this.logger.warn({
            message: 'Alert already resolved',
            alertId,
            resolvedAt: existing.resolvedAt,
          });
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

      this.logger.log({
        message: 'Alert resolved successfully',
        alertId,
        actorUserId,
        encounterId: alert.encounterId,
        eventId: event?.id,
      });

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return alert;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error({
        message: 'Failed to resolve alert',
        alertId,
        actorUserId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async listUnacknowledgedAlerts(hospitalId: number) {
    this.logger.debug({
      message: 'Listing unacknowledged alerts',
      hospitalId,
    });

    try {
      const alerts = await this.prisma.alert.findMany({
        where: { hospitalId, acknowledgedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug({
        message: 'Unacknowledged alerts retrieved',
        hospitalId,
        count: alerts.length,
      });

      return alerts;
    } catch (error) {
      this.logger.error({
        message: 'Failed to list unacknowledged alerts',
        hospitalId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async listAlertsForEncounter(encounterId: number) {
    this.logger.debug({
      message: 'Listing alerts for encounter',
      encounterId,
    });

    try {
      const alerts = await this.prisma.alert.findMany({
        where: { encounterId },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.debug({
        message: 'Encounter alerts retrieved',
        encounterId,
        count: alerts.length,
      });

      return alerts;
    } catch (error) {
      this.logger.error({
        message: 'Failed to list alerts for encounter',
        encounterId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
