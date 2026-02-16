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
  hospitalId: number;
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

  async createAlert(
    dto: CreateAlertDto,
    hospitalId: number,
    actorUserId: number,
    correlationId?: string,
  ) {
    this.loggingService.info(
      'Creating alert',
      {
        service: 'AlertsService',
        operation: 'createAlert',
        correlationId,
        encounterId: dto.encounterId,
        hospitalId,
      },
      {
        alertType: dto.type,
        severity: dto.severity,
        actorUserId,
      },
    );

    try {
      const { alert, event } = await this.prisma.$transaction(async (tx) => {
        const encounter = await tx.encounter.findUnique({
          where: {
            id_hospitalId: {
              id: dto.encounterId,
              hospitalId,
            },
          },
          select: { hospitalId: true },
        });
        if (!encounter) {
          this.loggingService.warn(
            'Alert creation rejected: Encounter not found or hospital mismatch',
            {
              service: 'AlertsService',
              operation: 'createAlert',
              correlationId,
              encounterId: dto.encounterId,
              hospitalId,
            },
            {
              alertType: dto.type,
              severity: dto.severity,
              actorUserId,
            },
          );
          throw new NotFoundException('Encounter does not belong to hospital');
        }

        const created = await this.createAlertTx(tx, {
          encounterId: dto.encounterId,
          hospitalId,
          type: dto.type,
          severity: dto.severity,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
          actor: { actorUserId },
        });

        return { alert: created.alert, event: created.event };
      });

      this.loggingService.info(
        'Alert created successfully',
        {
          service: 'AlertsService',
          operation: 'createAlert',
          correlationId,
          encounterId: dto.encounterId,
          hospitalId,
        },
        {
          alertId: alert.id,
          eventId: event.id,
          alertType: dto.type,
          severity: dto.severity,
          actorUserId,
        },
      );

      void this.events.dispatchEncounterEventAndMarkProcessed(event);

      return alert;
    } catch (error) {
      this.loggingService.error(
        'Failed to create alert',
        {
          service: 'AlertsService',
          operation: 'createAlert',
          correlationId,
          encounterId: dto.encounterId,
          hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          alertType: dto.type,
          severity: dto.severity,
          actorUserId,
        },
      );
      throw error;
    }
  }

  async createAlertTx(tx: Prisma.TransactionClient, args: CreateAlertTxArgs) {
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

  async acknowledgeAlert(
    alertId: number,
    hospitalId: number,
    actorUserId: number,
    correlationId?: string,
  ) {
    this.loggingService.info(
      'Acknowledging alert',
      {
        service: 'AlertsService',
        operation: 'acknowledgeAlert',
        correlationId,
        userId: actorUserId,
        hospitalId,
      },
      {
        alertId,
      },
    );

    try {
      const { alert, event } = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.alert.findUnique({ where: { id: alertId } });
        if (!existing) {
          this.loggingService.warn(
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
        if (existing.hospitalId !== hospitalId) {
          throw new NotFoundException(`Alert ${alertId} not found`);
        }
        if (existing.acknowledgedAt) {
          this.loggingService.warn(
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

      this.loggingService.info(
        'Alert acknowledged successfully',
        {
          service: 'AlertsService',
          operation: 'acknowledgeAlert',
          correlationId,
          encounterId: alert.encounterId,
          hospitalId,
          userId: actorUserId,
        },
        {
          alertId,
          eventId: event.id,
        },
      );

      void this.events.dispatchEncounterEventAndMarkProcessed(event);

      return alert;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.loggingService.error(
        'Failed to acknowledge alert',
        {
          service: 'AlertsService',
          operation: 'acknowledgeAlert',
          correlationId,
          userId: actorUserId,
          hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          alertId,
        },
      );
      throw error;
    }
  }

  async resolveAlert(
    alertId: number,
    hospitalId: number,
    actorUserId: number,
    correlationId?: string,
  ) {
    this.loggingService.info(
      'Resolving alert',
      {
        service: 'AlertsService',
        operation: 'resolveAlert',
        correlationId,
        userId: actorUserId,
        hospitalId,
      },
      {
        alertId,
      },
    );

    try {
      const { alert, event } = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.alert.findUnique({ where: { id: alertId } });
        if (!existing) {
          this.loggingService.warn(
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
        if (existing.hospitalId !== hospitalId) {
          throw new NotFoundException(`Alert ${alertId} not found`);
        }
        if (existing.resolvedAt) {
          this.loggingService.warn(
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

      this.loggingService.info(
        'Alert resolved successfully',
        {
          service: 'AlertsService',
          operation: 'resolveAlert',
          correlationId,
          encounterId: alert.encounterId,
          hospitalId,
          userId: actorUserId,
        },
        {
          alertId,
          eventId: event.id,
        },
      );

      void this.events.dispatchEncounterEventAndMarkProcessed(event);

      return alert;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.loggingService.error(
        'Failed to resolve alert',
        {
          service: 'AlertsService',
          operation: 'resolveAlert',
          correlationId,
          userId: actorUserId,
          hospitalId,
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
    this.loggingService.debug(
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

      this.loggingService.debug(
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
      this.loggingService.error(
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

  async listAlertsForEncounter(encounterId: number, hospitalId: number, correlationId?: string) {
    this.loggingService.debug(
      'Listing alerts for encounter',
      {
        service: 'AlertsService',
        operation: 'listAlertsForEncounter',
        correlationId,
        encounterId,
        hospitalId,
      },
    );

    try {
      const alerts = await this.prisma.alert.findMany({
        where: { encounterId, hospitalId },
        orderBy: { createdAt: 'desc' },
      });

      this.loggingService.debug(
        'Encounter alerts retrieved',
        {
          service: 'AlertsService',
          operation: 'listAlertsForEncounter',
          correlationId,
          encounterId,
          hospitalId,
        },
        {
          count: alerts.length,
        },
      );

      return alerts;
    } catch (error) {
      this.loggingService.error(
        'Failed to list alerts for encounter',
        {
          service: 'AlertsService',
          operation: 'listAlertsForEncounter',
          correlationId,
          encounterId,
          hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }
}
