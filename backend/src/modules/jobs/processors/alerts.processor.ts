// backend/src/modules/jobs/processors/alerts.processor.ts
// BullMQ processor for alert rules.

import { Process, Processor } from '@nestjs/bullmq';

import { AlertsService } from '../../alerts/alerts.service';
import { EventsService } from '../../events/events.service';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_REASSESSMENT_MINUTES = 30;
const ALERT_TYPE = 'TRIAGE_REASSESSMENT_OVERDUE';

@Processor('alerts')
export class AlertsProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly events: EventsService,
  ) {}

  @Process('triage-reassessment')
  async handleTriageReassessment(): Promise<void> {
    const thresholdMinutes = Number(
      process.env.TRIAGE_REASSESSMENT_MINUTES ?? DEFAULT_REASSESSMENT_MINUTES,
    );
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    const encounters = await this.prisma.encounter.findMany({
      where: {
        triagedAt: { lt: cutoff },
        status: { in: ['ADMITTED', 'TRIAGE', 'WAITING'] },
      },
      select: { id: true, hospitalId: true },
      take: 100,
    });

    for (const encounter of encounters) {
      if (!encounter.hospitalId) {
        continue;
      }

      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          encounterId: encounter.id,
          hospitalId: encounter.hospitalId,
          type: ALERT_TYPE,
          resolvedAt: null,
        },
      });

      if (existingAlert) {
        continue;
      }

      const { alert, event } = await this.prisma.$transaction(async (tx) => {
        return this.alerts.createAlertTx(tx, {
          encounterId: encounter.id,
          hospitalId: encounter.hospitalId,
          type: ALERT_TYPE,
          severity: 'MEDIUM',
          metadata: { thresholdMinutes },
        });
      });

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

    }
  }
}
