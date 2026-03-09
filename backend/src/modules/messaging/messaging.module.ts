// backend/src/modules/messaging/messaging.module.ts

import { Module, forwardRef } from '@nestjs/common';

import { AlertsModule } from '../alerts/alerts.module';
import { AssetsModule } from '../assets/assets.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagingController } from './messaging.controller';
import { PatientMessagingController } from './patient-messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  controllers: [MessagingController, PatientMessagingController],
  providers: [MessagingService],
  imports: [AssetsModule, forwardRef(() => EventsModule), forwardRef(() => AlertsModule), PrismaModule],
  exports: [MessagingService],
})
export class MessagingModule {}
