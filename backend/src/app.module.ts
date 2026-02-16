// backend/src/app.module.ts
// app.module.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Root application module.
// Wires together Prisma, Encounters, Realtime, and Health modules.

import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AlertsModule } from './modules/alerts/alerts.module';
import { AssetsModule } from './modules/assets/assets.module';
import { AuthModule } from './modules/auth/auth.module';
import { EncountersModule } from './modules/encounters/encounters.module';
import { HealthModule } from './modules/health/health.module';
import { HospitalsModule } from './modules/hospitals/hospitals.module';
import { IntakeModule } from './modules/intake/intake.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { LoggingModule } from './modules/logging/logging.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { PatientsModule } from './modules/patients/patients.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RedisModule } from './modules/redis/redis.module';
import { TriageModule } from './modules/triage/triage.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 1000, // 1000 requests per minute per IP (prevents abuse, allows legitimate use)
      },
    ]),
    PrismaModule,
    RedisModule,   // Global Redis client for caching (location, sessions)
    LoggingModule, // Global logging with correlation support
    AuthModule,
    UsersModule,
    HospitalsModule,
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
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
