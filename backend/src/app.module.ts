// backend/src/app.module.ts
// app.module.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Root application module.
// Wires together Prisma, Encounters, Realtime, and Health modules.

import { Module } from '@nestjs/common';

import { AlertsModule } from './modules/alerts/alerts.module';
import { AssetsModule } from './modules/assets/assets.module';
import { EncountersModule } from './modules/encounters/encounters.module';
import { HealthModule } from './modules/health/health.module';
import { IntakeModule } from './modules/intake/intake.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { PatientsModule } from './modules/patients/patients.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { TriageModule } from './modules/triage/triage.module';

@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
    EncountersModule,
    MessagingModule,
    AlertsModule,
    TriageModule,
    AssetsModule,
    PatientsModule,
    IntakeModule,
    JobsModule,
    HealthModule,
  ],
})
export class AppModule {}
