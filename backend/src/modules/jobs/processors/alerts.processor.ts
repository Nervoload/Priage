import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { AlertRulesService } from '../../alerts/alert-rules.service';
import { LoggingService } from '../../logging/logging.service';

type EvaluateEncounterJob = {
  encounterId: number;
  hospitalId: number;
  sourceEventId?: number;
};

@Processor('alerts')
export class AlertsProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertsProcessor.name);

  constructor(
    private readonly rules: AlertRulesService,
    private readonly logging: LoggingService,
  ) {
    super();
    this.logger.log('AlertsProcessor initialized');
  }

  async process(job: Job<unknown, unknown, string>): Promise<void> {
    const startedAt = Date.now();
    try {
      switch (job.name) {
        case 'evaluate-encounter': {
          const data = job.data as EvaluateEncounterJob;
          await this.rules.evaluateEncounter(data.encounterId, data.hospitalId);
          break;
        }
        case 'sweep-alert-rules':
          await this.rules.sweepAll();
          break;
        default:
          throw new Error(`Unknown alert job name: ${job.name}`);
      }
      await this.logging.debug('Alert job completed', {
        service: 'AlertsProcessor',
        operation: 'process',
      }, { jobId: String(job.id ?? ''), jobName: job.name, durationMs: Date.now() - startedAt });
    } catch (error) {
      await this.logging.error('Alert job failed', {
        service: 'AlertsProcessor',
        operation: 'process',
      }, error instanceof Error ? error : new Error(String(error)), {
        jobId: String(job.id ?? ''),
        jobName: job.name,
        attemptsMade: job.attemptsMade,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }
}
