// backend/src/modules/jobs/processors/alerts.processor.ts
// BullMQ processor for alert rules.

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { AlertsService } from '../../alerts/alerts.service';
import { EventsService } from '../../events/events.service';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_REASSESSMENT_MINUTES = 30;
const ALERT_TYPE = 'TRIAGE_REASSESSMENT_OVERDUE';

@Processor('alerts')
export class AlertsProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly events: EventsService,
  ) {
    super();
    this.logger.log('AlertsProcessor initialized');
  }

  async process(job: Job<any, any, string>): Promise<void> {
    const startTime = Date.now();
    
    this.logger.debug({
      message: 'Processing alert job',
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
    });

    try {
      switch (job.name) {
        case 'triage-reassessment':
          await this.handleTriageReassessment();
          break;
        default:
          this.logger.error({
            message: 'Unknown alert job name',
            jobId: job.id,
            jobName: job.name,
          });
          throw new Error(`Unknown job name: ${job.name}`);
      }

      const duration = Date.now() - startTime;
      this.logger.log({
        message: 'Alert job completed successfully',
        jobId: job.id,
        jobName: job.name,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        message: 'Alert job processing failed',
        jobId: job.id,
        jobName: job.name,
        attemptsMade: job.attemptsMade,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private async handleTriageReassessment(): Promise<void> {
    const thresholdMinutes = Number(
      process.env.TRIAGE_REASSESSMENT_MINUTES ?? DEFAULT_REASSESSMENT_MINUTES,
    );
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    this.logger.debug({
      message: 'Checking for overdue triage reassessments',
      thresholdMinutes,
      cutoff,
    });

    try {
      const encounters = await this.prisma.encounter.findMany({
        where: {
          triagedAt: { lt: cutoff },
          status: { in: ['ADMITTED', 'TRIAGE', 'WAITING'] },
        },
        select: { id: true, hospitalId: true },
        take: 100,
      });

      if (encounters.length === 0) {
        this.logger.debug('No encounters requiring triage reassessment alerts');
        return;
      }

      this.logger.log({
        message: 'Found encounters requiring reassessment check',
        count: encounters.length,
        thresholdMinutes,
      });

      let alertsCreated = 0;
      let alertsSkipped = 0;
      let errors = 0;

      for (const encounter of encounters) {
        if (!encounter.hospitalId) {
          this.logger.warn({
            message: 'Skipping encounter without hospitalId',
            encounterId: encounter.id,
          });
          alertsSkipped++;
          continue;
        }

        try {
          const existingAlert = await this.prisma.alert.findFirst({
            where: {
              encounterId: encounter.id,
              hospitalId: encounter.hospitalId,
              type: ALERT_TYPE,
              resolvedAt: null,
            },
          });

          if (existingAlert) {
            this.logger.debug({
              message: 'Alert already exists for encounter',
              encounterId: encounter.id,
              alertId: existingAlert.id,
            });
            alertsSkipped++;
            continue;
          }

          const { alert, event } = await this.prisma.$transaction(async (tx) => {
            return this.alerts.createAlertTx(tx, {
              encounterId: encounter.id,
              hospitalId: encounter.hospitalId ?? undefined,
              type: ALERT_TYPE,
              severity: 'MEDIUM',
              metadata: { thresholdMinutes },
            });
          });

          if (event) {
            this.events.dispatchEncounterEvent(event);
          }

          this.logger.log({
            message: 'Triage reassessment alert created',
            encounterId: encounter.id,
            alertId: alert.id,
            eventId: event?.id,
          });

          alertsCreated++;
        } catch (error) {
          errors++;
          this.logger.error({
            message: 'Failed to create triage reassessment alert',
            encounterId: encounter.id,
            hospitalId: encounter.hospitalId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          // Continue processing other encounters even if one fails
        }
      }

      this.logger.log({
        message: 'Triage reassessment check completed',
        totalEncounters: encounters.length,
        alertsCreated,
        alertsSkipped,
        errors,
      });
    } catch (error) {
      this.logger.error({
        message: 'Triage reassessment job failed',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
