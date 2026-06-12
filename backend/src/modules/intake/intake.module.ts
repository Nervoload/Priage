// backend/src/modules/intake/intake.module.ts
// First-party patient intake module.
// Imports IntakeSessionsModule as shared internal workflow orchestration,
// not as a dependency on partner-specific platform behavior.

import { Module } from '@nestjs/common';

import { AssetsModule } from '../assets/assets.module';
import { EventsModule } from '../events/events.module';
import { IntakeSessionsModule } from '../intake-sessions/intake-sessions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IntakeController } from './intake.controller';
import { OpenAiCompatibleTriageInterviewProvider } from './interview/triage-interview.provider';
import { TriageInterviewService } from './interview/triage-interview.service';
import { IntakeService } from './intake.service';

@Module({
  controllers: [IntakeController],
  providers: [IntakeService, TriageInterviewService, OpenAiCompatibleTriageInterviewProvider],
  imports: [AssetsModule, EventsModule, PrismaModule, IntakeSessionsModule],
})
export class IntakeModule {}
