// backend/src/modules/auth/auth.module.ts
// John Surette
// Dec 8, 2025
// auth.module.ts
// nestjs auth module setup
// Auth, session, service, guards

import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PatientIdempotencyService } from './patient-idempotency.service';
import { PatientRateLimitGuard } from './guards/patient-rate-limit.guard';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, PatientIdempotencyService, PatientRateLimitGuard],
  exports: [AuthService, PatientIdempotencyService, PatientRateLimitGuard],
})
export class AuthModule {}
