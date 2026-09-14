import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AlertWebhooksController } from './alert-webhooks.controller';
import { AlertWebhooksService } from './alert-webhooks.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookOutboxService } from './webhook-outbox.service';
import { WebhookSecretService } from './webhook-secret.service';
import { WebhookUrlPolicyService } from './webhook-url-policy.service';

@Module({
  imports: [PrismaModule],
  controllers: [AlertWebhooksController],
  providers: [
    AlertWebhooksService,
    WebhookDeliveryService,
    WebhookOutboxService,
    WebhookSecretService,
    WebhookUrlPolicyService,
  ],
  exports: [WebhookDeliveryService, WebhookOutboxService],
})
export class WebhooksModule {}
