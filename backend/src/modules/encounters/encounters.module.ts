// backend/src/modules/encounters/encounters.module.ts
// encounters.module.ts
// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Jan 6 2026
// Encounters module: REST endpoints + business logic for encounter lifecycle and related objects.

import { Module } from '@nestjs/common';

import { RealtimeModule } from '../realtime/realtime.module';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';

@Module({
  controllers: [EncountersController],
  providers: [EncountersService],
  imports: [RealtimeModule],
})
export class EncountersModule {}
