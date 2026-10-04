import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClinicPilotModule } from '../clinic/clinic-pilot.module';
import { EventsModule } from '../events/events.module';
import { NotificationsService } from './notifications.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationProvider } from './notification-provider';
import { AppointmentRecoveryService } from './appointment-recovery.service';
import { EmailWebhookController, NotificationsController } from './notifications.controller';

@Module({ imports: [PrismaModule, ClinicPilotModule, EventsModule], providers: [NotificationsService, NotificationDeliveryService, NotificationProvider, AppointmentRecoveryService], controllers: [NotificationsController, EmailWebhookController], exports: [NotificationsService, NotificationDeliveryService, AppointmentRecoveryService] })
export class NotificationsModule {}
