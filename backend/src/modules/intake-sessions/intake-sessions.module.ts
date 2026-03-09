// Shared intake-session orchestration module.
// This is internal workflow infrastructure used by first-party flows
// (patient intake / priage) and by the partner-facing platform API.
// It is not itself a public partner API surface.

import { Module, forwardRef } from '@nestjs/common';

import { EventsModule } from '../events/events.module';
import { LoggingModule } from '../logging/logging.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IntakeSessionsService } from './intake-sessions.service';

@Module({
  imports: [PrismaModule, forwardRef(() => EventsModule), LoggingModule],
  providers: [IntakeSessionsService],
  exports: [IntakeSessionsService],
})
export class IntakeSessionsModule {}
