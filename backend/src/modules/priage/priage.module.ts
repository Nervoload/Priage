// First-party patient-facing Priage module.
// Reuses IntakeSessionsModule as shared intake workflow orchestration.

import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PriageController } from './priage.controller';
import { PriageService } from './priage.service';
import { ClinicPilotModule } from '../clinic/clinic-pilot.module';

@Module({
  controllers: [PriageController],
  providers: [PriageService],
  imports: [PrismaModule, ClinicPilotModule],
})
export class PriageModule {}
