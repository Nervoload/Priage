// backend/src/modules/hospitals/hospitals.module.ts
// Hospital management module

import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { HospitalsController } from './hospitals.controller';
import { HospitalsService } from './hospitals.service';

@Module({
  imports: [PrismaModule],
  controllers: [HospitalsController],
  providers: [HospitalsService],
  exports: [HospitalsService],
})
export class HospitalsModule {}
