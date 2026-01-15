// backend/src/modules/triage/triage.module.ts

import { Module } from '@nestjs/common';

import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TriageController } from './triage.controller';
import { TriageService } from './triage.service';

@Module({
  controllers: [TriageController],
  providers: [TriageService],
  imports: [EventsModule, PrismaModule],
})
export class TriageModule {}
