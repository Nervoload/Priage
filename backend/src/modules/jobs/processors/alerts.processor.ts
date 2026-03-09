// backend/src/modules/jobs/processors/alerts.processor.ts
// BullMQ processor for alert rules.

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { AlertsService } from '../../alerts/alerts.service';
import { EventsService } from '../../events/events.service';
import { LoggingService } from '../../logging/logging.service';
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
    private readonly loggingService: LoggingService,
  ) {
    super();
    this.logger.log('AlertsProcessor initialized');
  }

  async process(job: Job<any, any, string>): Promise<void> {
    const startTime = Date.now();
    
    await this.loggingService.debug(
      'Processing alert job',
      {
        service: 'AlertsProcessor',
        operation: 'process',
        correlationId: undefined,
      },
      {
        jobId: job.id ? String(job.id) : undefined,
        jobName: job.name,
        attemptsMade: job.attemptsMade,
      },
    );

    try {
      switch (job.name) {
        case 'triage-reassessment':
          await this.handleTriageReassessment();
          break;
        default:
          await this.loggingService.error(
            'Unknown alert job name',
            {
              service: 'AlertsProcessor',
              operation: 'process',
              correlationId: undefined,
            },
            new Error(`Unknown job name: ${job.name}`),
            {
              jobId: job.id ? String(job.id) : undefined,
              jobName: job.name,
            },
          );
          throw new Error(`Unknown job name: ${job.name}`);
      }

      const duration = Date.now() - startTime;
      // Only log completion in debug mode to reduce noise
      await this.loggingService.debug(
        'Alert job completed successfully',
        {
          service: 'AlertsProcessor',
          operation: 'process',
          correlationId: undefined,
        },
        {
          jobId: job.id ? String(job.id) : undefined,
          jobName: job.name,
          durationMs: duration,
        },
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.loggingService.error(
        'Alert job processing failed',
        {
          service: 'AlertsProcessor',
          operation: 'process',
          correlationId: undefined,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          jobId: job.id ? String(job.id) : undefined,
          jobName: job.name,
          attemptsMade: job.attemptsMade,
          durationMs: duration,
        },
      );
      throw error;
    }
  }

  private async handleTriageReassessment(): Promise<void> {
    const thresholdMinutes = Number(
      process.env.TRIAGE_REASSESSMENT_MINUTES ?? DEFAULT_REASSESSMENT_MINUTES,
    );
    const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    await this.loggingService.debug(
      'Checking for overdue triage reassessments',
      {
        service: 'AlertsProcessor',
        operation: 'handleTriageReassessment',
        correlationId: undefined,
      },
      {
        thresholdMinutes,
      },
    );

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
        // Silently return when no alerts needed - reduces log noise
        // Set LOG_LEVEL=debug to see these messages
        await this.loggingService.debug(
          'No encounters requiring triage reassessment alerts',
          {
            service: 'AlertsProcessor',
            operation: 'handleTriageReassessment',
            correlationId: undefined,
          },
        );
        return;
      }

      await this.loggingService.info(
        'Found encounters requiring reassessment check',
        {
          service: 'AlertsProcessor',
          operation: 'handleTriageReassessment',
          correlationId: undefined,
        },
        {
          count: encounters.length,
          thresholdMinutes,
        },
      );

      let alertsCreated = 0;
      let alertsSkipped = 0;
      let errors = 0;

      for (const encounter of encounters) {
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
            await this.loggingService.debug(
              'Alert already exists for encounter',
              {
                service: 'AlertsProcessor',
                operation: 'handleTriageReassessment',
                correlationId: undefined,
                encounterId: encounter.id,
                hospitalId: encounter.hospitalId,
              },
              {
                alertId: existingAlert.id,
              },
            );
            alertsSkipped++;
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

          void this.events.dispatchEncounterEventAndMarkProcessed(event);

          await this.loggingService.info(
            'Triage reassessment alert created',
            {
              service: 'AlertsProcessor',
              operation: 'handleTriageReassessment',
              correlationId: undefined,
              encounterId: encounter.id,
              hospitalId: encounter.hospitalId,
            },
            {
              alertId: alert.id,
              eventId: event.id,
            },
          );

          alertsCreated++;
        } catch (error) {
          errors++;
          await this.loggingService.error(
            'Failed to create triage reassessment alert',
            {
              service: 'AlertsProcessor',
              operation: 'handleTriageReassessment',
              correlationId: undefined,
              encounterId: encounter.id,
              hospitalId: encounter.hospitalId,
            },
            error instanceof Error ? error : new Error(String(error)),
          );
          // Continue processing other encounters even if one fails
        }
      }

      await this.loggingService.info(
        'Triage reassessment check completed',
        {
          service: 'AlertsProcessor',
          operation: 'handleTriageReassessment',
          correlationId: undefined,
        },
        {
          totalEncounters: encounters.length,
          alertsCreated,
          alertsSkipped,
          errors,
        },
      );
    } catch (error) {
      await this.loggingService.error(
        'Triage reassessment job failed',
        {
          service: 'AlertsProcessor',
          operation: 'handleTriageReassessment',
          correlationId: undefined,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }
}
