// backend/src/app.module.ts
// app.module.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Root application module.
// Wires together Prisma, Encounters, Realtime, and Health modules.

import { Module } from '@nestjs/common';

import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './modules/config/config.module';
import { EncountersModule } from './modules/encounters/encounters.module';
import { HealthModule } from './modules/health/health.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule,
    ObservabilityModule,
    PrismaModule,
    TenantModule,
    UsersModule,
    AuthModule,
    RealtimeModule,
    EncountersModule,
    HealthModule,
  ],
})
export class AppModule {}
