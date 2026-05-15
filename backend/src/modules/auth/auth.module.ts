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

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
