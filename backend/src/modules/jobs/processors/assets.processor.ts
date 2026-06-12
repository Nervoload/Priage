import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { AssetsService } from '../../assets/assets.service';
import { LoggingService } from '../../logging/logging.service';

@Processor('assets')
export class AssetsProcessor extends WorkerHost {
  constructor(
    private readonly assets: AssetsService,
    private readonly logging: LoggingService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'reconcile-deletes') {
      throw new Error(`Unknown assets job: ${job.name}`);
    }
    const result = await this.assets.reconcilePendingDeletes();
    await this.logging.info('Asset deletion reconciliation completed', {
      service: 'AssetsProcessor',
      operation: 'process',
    }, result);
  }
}

