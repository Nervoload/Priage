import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ClinicPilotService } from './clinic-pilot.service';
import { ClinicEntryService } from './clinic-entry.service';

@Module({
  imports: [PrismaModule],
  providers: [ClinicPilotService, ClinicEntryService],
  exports: [ClinicPilotService, ClinicEntryService],
})
export class ClinicPilotModule {}
