import { Module } from '@nestjs/common';

import { AssessmentModule } from '../assessment/assessment.module';
import { EventsModule } from '../events/events.module';
import { IntakeSessionsModule } from '../intake-sessions/intake-sessions.module';
import { IntakeModule } from '../intake/intake.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClinicPilotModule } from './clinic-pilot.module';
import { ClinicIntakeController } from './clinic-intake.controller';
import { ClinicIntakeService } from './clinic-intake.service';
import { ClinicAssessmentService } from './clinic-assessment.service';
import { ClinicAppointmentsController } from './clinic-appointments.controller';
import { ClinicAppointmentsService } from './clinic-appointments.service';
import { LegalDocumentsModule } from '../legal/legal-documents.module';
import { ClinicalAccessModule } from '../clinical-access/clinical-access.module';
import { SensitiveReadAuditModule } from '../audit/sensitive-read-audit.module';
import { ClinicCareController } from './clinic-care.controller';
import { ClinicCareService } from './clinic-care.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppointmentRecoveryController, AppointmentRecoveryGuard } from './appointment-recovery.controller';
import { ClinicQuestionnaireController } from './questionnaire/clinic-questionnaire.controller';
import { ClinicAnalyticsController } from './analytics/clinic-analytics.controller';
import { ClinicAnalyticsService } from './analytics/clinic-analytics.service';
import { ClinicQuestionnaireService } from './questionnaire/clinic-questionnaire.service';

@Module({
  imports: [PrismaModule, ClinicPilotModule, IntakeSessionsModule, IntakeModule, AssessmentModule, EventsModule, LegalDocumentsModule, ClinicalAccessModule, SensitiveReadAuditModule, NotificationsModule],
  controllers: [ClinicIntakeController, ClinicAppointmentsController, ClinicCareController, AppointmentRecoveryController, ClinicQuestionnaireController, ClinicAnalyticsController],
  providers: [ClinicIntakeService, ClinicAssessmentService, ClinicAppointmentsService, ClinicCareService, AppointmentRecoveryGuard, ClinicQuestionnaireService, ClinicAnalyticsService],
  exports: [ClinicAppointmentsService],
})
export class ClinicIntakeModule {}
