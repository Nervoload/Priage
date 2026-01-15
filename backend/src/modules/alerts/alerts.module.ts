// backend/src/modules/alerts/alerts.module.ts

import { Module } from '@nestjs/common';

import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService],
  imports: [EventsModule, PrismaModule],
  exports: [AlertsService],
})
export class AlertsModule {}
