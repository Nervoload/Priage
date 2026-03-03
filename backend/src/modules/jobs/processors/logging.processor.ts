// backend/src/modules/jobs/processors/logging.processor.ts
// BullMQ processor for logging retention.

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { LoggingService } from '../../logging/logging.service';

@Processor('logging')
export class LoggingProcessor extends WorkerHost {
  private readonly logger = new Logger(LoggingProcessor.name);

  constructor(private readonly loggingService: LoggingService) {
    super();
    this.logger.log('LoggingProcessor initialized');
  }

  async process(job: Job<any, any, string>): Promise<void> {
    switch (job.name) {
      case 'purge-old-logs':
        await this.handlePurgeOldLogs();
        return;
      default:
        this.logger.error({
          message: 'Unknown logging job name',
          jobId: job.id,
          jobName: job.name,
        });
        throw new Error(`Unknown logging job name: ${job.name}`);
    }
  }

  private async handlePurgeOldLogs() {
    const retentionDays = Number(process.env.LOG_RETENTION_DAYS ?? '30');
    const normalizedRetentionDays =
      Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 30;
    const cutoff = new Date(Date.now() - normalizedRetentionDays * 24 * 60 * 60 * 1000);

    const result = await this.loggingService.purgeOlderThan(cutoff);

    this.logger.log({
      message: 'Completed log retention cleanup',
      cutoff: cutoff.toISOString(),
      retentionDays: normalizedRetentionDays,
      deletedLogs: result.deletedLogs,
      deletedReports: result.deletedReports,
    });

    await this.loggingService.info(
      'Completed log retention cleanup',
      {
        service: 'LoggingProcessor',
        operation: 'handlePurgeOldLogs',
        correlationId: undefined,
      },
      {
        retentionDays: normalizedRetentionDays,
        deletedLogs: result.deletedLogs,
        deletedReports: result.deletedReports,
      },
    );
  }
}
