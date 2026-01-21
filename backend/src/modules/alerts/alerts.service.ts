// backend/src/modules/alerts/alerts.service.ts
// Alerts service for safety escalations.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AlertSeverity, EventType, Prisma } from '@prisma/client';

import { EventsService } from '../events/events.service';
import { LoggingService } from '../logging/logging.service';
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
    private readonly loggingService: LoggingService,
  ) {
    this.logger.log('AlertsService initialized');
  }

  async createAlert(dto: CreateAlertDto, correlationId?: string) {
    await this.loggingService.info(
      'Creating alert',
      {
        service: 'AlertsService',
        operation: 'createAlert',
        correlationId,
        encounterId: dto.encounterId,
        hospitalId: dto.hospitalId,
      },
      {
        alertType: dto.type,
        severity: dto.severity,
        actorUserId: dto.actorUserId,
      },
    );

    try {
      const { alert, event } = await this.prisma.$transaction(async (tx) => {
        const encounter = await tx.encounter.findUnique({
          where: { id: dto.encounterId },
          select: { hospitalId: true },
        });
        if (!encounter || encounter.hospitalId !== dto.hospitalId) {
          await this.loggingService.warn(
            'Alert creation rejected: Encounter not found or hospital mismatch',
            {
              service: 'AlertsService',
              operation: 'createAlert',
              correlationId,
              encounterId: dto.encounterId,
              hospitalId: dto.hospitalId,
            },
            {
              alertType: dto.type,
              severity: dto.severity,
              actorUserId: dto.actorUserId,
            },
          );
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

      await this.loggingService.info(
        'Alert created successfully',
        {
          service: 'AlertsService',
          operation: 'createAlert',
          correlationId,
          encounterId: dto.encounterId,
          hospitalId: dto.hospitalId,
        },
        {
          alertId: alert.id,
          eventId: event?.id,
          alertType: dto.type,
          severity: dto.severity,
          actorUserId: dto.actorUserId,
        },
      );

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return alert;
    } catch (error) {
      await this.loggingService.error(
        'Failed to create alert',
        {
          service: 'AlertsService',
          operation: 'createAlert',
          correlationId,
          encounterId: dto.encounterId,
          hospitalId: dto.hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          alertType: dto.type,
          severity: dto.severity,
          actorUserId: dto.actorUserId,
        },
      );
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

  async acknowledgeAlert(alertId: number, actorUserId: number, correlationId?: string) {
    await this.loggingService.info(
      'Acknowledging alert',
      {
        service: 'AlertsService',
        operation: 'acknowledgeAlert',
        correlationId,
        userId: actorUserId,
      },
      {
        alertId,
      },
    );

    try {
      const { alert, event } = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.alert.findUnique({ where: { id: alertId } });
        if (!existing) {
          await this.loggingService.warn(
            'Alert not found for acknowledgement',
            {
              service: 'AlertsService',
              operation: 'acknowledgeAlert',
              correlationId,
              userId: actorUserId,
            },
            {
              alertId,
            },
          );
          throw new NotFoundException(`Alert ${alertId} not found`);
        }
        if (existing.acknowledgedAt) {
          await this.loggingService.warn(
            'Alert already acknowledged',
            {
              service: 'AlertsService',
              operation: 'acknowledgeAlert',
              correlationId,
              userId: actorUserId,
            },
            {
              alertId,
              acknowledgedAt: existing.acknowledgedAt,
            },
          );
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

      await this.loggingService.info(
        'Alert acknowledged successfully',
        {
          service: 'AlertsService',
          operation: 'acknowledgeAlert',
          correlationId,
          encounterId: alert.encounterId,
          userId: actorUserId,
        },
        {
          alertId,
          eventId: event?.id,
        },
      );

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return alert;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      await this.loggingService.error(
        'Failed to acknowledge alert',
        {
          service: 'AlertsService',
          operation: 'acknowledgeAlert',
          correlationId,
          userId: actorUserId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          alertId,
        },
      );
      throw error;
    }
  }

  async resolveAlert(alertId: number, actorUserId: number, correlationId?: string) {
    await this.loggingService.info(
      'Resolving alert',
      {
        service: 'AlertsService',
        operation: 'resolveAlert',
        correlationId,
        userId: actorUserId,
      },
      {
        alertId,
      },
    );

    try {
      const { alert, event } = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.alert.findUnique({ where: { id: alertId } });
        if (!existing) {
          await this.loggingService.warn(
            'Alert not found for resolution',
            {
              service: 'AlertsService',
              operation: 'resolveAlert',
              correlationId,
              userId: actorUserId,
            },
            {
              alertId,
            },
          );
          throw new NotFoundException(`Alert ${alertId} not found`);
        }
        if (existing.resolvedAt) {
          await this.loggingService.warn(
            'Alert already resolved',
            {
              service: 'AlertsService',
              operation: 'resolveAlert',
              correlationId,
              userId: actorUserId,
            },
            {
              alertId,
              resolvedAt: existing.resolvedAt,
            },
          );
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

      await this.loggingService.info(
        'Alert resolved successfully',
        {
          service: 'AlertsService',
          operation: 'resolveAlert',
          correlationId,
          encounterId: alert.encounterId,
          userId: actorUserId,
        },
        {
          alertId,
          eventId: event?.id,
        },
      );

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return alert;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      await this.loggingService.error(
        'Failed to resolve alert',
        {
          service: 'AlertsService',
          operation: 'resolveAlert',
          correlationId,
          userId: actorUserId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          alertId,
        },
      );
      throw error;
    }
  }

  async listUnacknowledgedAlerts(hospitalId: number, correlationId?: string) {
    await this.loggingService.debug(
      'Listing unacknowledged alerts',
      {
        service: 'AlertsService',
        operation: 'listUnacknowledgedAlerts',
        correlationId,
        hospitalId,
      },
    );

    try {
      const alerts = await this.prisma.alert.findMany({
        where: { hospitalId, acknowledgedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      await this.loggingService.debug(
        'Unacknowledged alerts retrieved',
        {
          service: 'AlertsService',
          operation: 'listUnacknowledgedAlerts',
          correlationId,
          hospitalId,
        },
        {
          count: alerts.length,
        },
      );

      return alerts;
    } catch (error) {
      await this.loggingService.error(
        'Failed to list unacknowledged alerts',
        {
          service: 'AlertsService',
          operation: 'listUnacknowledgedAlerts',
          correlationId,
          hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async listAlertsForEncounter(encounterId: number, correlationId?: string) {
    await this.loggingService.debug(
      'Listing alerts for encounter',
      {
        service: 'AlertsService',
        operation: 'listAlertsForEncounter',
        correlationId,
        encounterId,
      },
    );

    try {
      const alerts = await this.prisma.alert.findMany({
        where: { encounterId },
        orderBy: { createdAt: 'desc' },
      });

      await this.loggingService.debug(
        'Encounter alerts retrieved',
        {
          service: 'AlertsService',
          operation: 'listAlertsForEncounter',
          correlationId,
          encounterId,
        },
        {
          count: alerts.length,
        },
      );

      return alerts;
    } catch (error) {
      await this.loggingService.error(
        'Failed to list alerts for encounter',
        {
          service: 'AlertsService',
          operation: 'listAlertsForEncounter',
          correlationId,
          encounterId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }
}
