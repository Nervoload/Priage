import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationDeliveryService } from '../../notifications/notification-delivery.service';
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly delivery: NotificationDeliveryService) { super(); }
  async process(job: Job): Promise<void> { if (job.name !== 'deliver-notifications') throw new Error('Unknown notification job'); await this.delivery.deliverPending(); }
}
