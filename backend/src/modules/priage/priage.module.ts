// First-party patient-facing Priage module.
// Reuses IntakeSessionsModule as shared intake workflow orchestration.

import { Module } from '@nestjs/common';

import { EventsModule } from '../events/events.module';
import { IntakeSessionsModule } from '../intake-sessions/intake-sessions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PriageController } from './priage.controller';
import { PriageService } from './priage.service';

@Module({
  controllers: [PriageController],
  providers: [PriageService],
  imports: [EventsModule, PrismaModule, IntakeSessionsModule],
})
export class PriageModule {}
