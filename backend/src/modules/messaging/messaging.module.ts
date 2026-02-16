// backend/src/modules/messaging/messaging.module.ts

import { Module } from '@nestjs/common';

import { AlertsModule } from '../alerts/alerts.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagingController } from './messaging.controller';
import { PatientMessagingController } from './patient-messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  controllers: [MessagingController, PatientMessagingController],
  providers: [MessagingService],
  imports: [EventsModule, AlertsModule, PrismaModule],
})
export class MessagingModule {}
