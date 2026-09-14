import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { WebhookDeliveryService } from '../../webhooks/webhook-delivery.service';

@Processor('webhooks')
export class WebhooksProcessor extends WorkerHost {
  constructor(private readonly deliveries: WebhookDeliveryService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'deliver-webhooks') throw new Error(`Unknown webhook job name: ${job.name}`);
    await this.deliveries.deliverPending();
  }
}
