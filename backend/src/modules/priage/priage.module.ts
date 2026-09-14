// First-party patient-facing Priage module.
// Reuses IntakeSessionsModule as shared intake workflow orchestration.

import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PriageController } from './priage.controller';
import { PriageService } from './priage.service';

@Module({
  controllers: [PriageController],
  providers: [PriageService],
  imports: [PrismaModule],
})
export class PriageModule {}
