import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PatientAuthController } from './patient-auth.controller';
import { PatientAuthService } from './patient-auth.service';

@Module({
  controllers: [PatientAuthController],
  providers: [PatientAuthService],
  imports: [PrismaModule],
  exports: [PatientAuthService],
})
export class PatientAuthModule {}
