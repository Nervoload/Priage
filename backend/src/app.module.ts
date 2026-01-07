// backend/src/app.module.ts
// app.module.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Root application module.
// Wires together Prisma, Encounters, Realtime, and Health modules.

import { Module } from '@nestjs/common';

import { EncountersModule } from './modules/encounters/encounters.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RealtimeModule } from './modules/realtime/realtime.module';

@Module({
  imports: [PrismaModule, RealtimeModule, EncountersModule, HealthModule],
})
export class AppModule {}
