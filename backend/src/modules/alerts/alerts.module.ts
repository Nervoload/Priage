// backend/src/modules/alerts/alerts.module.ts

import { Module, forwardRef } from '@nestjs/common';

import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertRulesService } from './alert-rules.service';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertRulesService],
  imports: [forwardRef(() => EventsModule), PrismaModule, WebhooksModule],
  exports: [AlertsService, AlertRulesService],
})
export class AlertsModule {}
