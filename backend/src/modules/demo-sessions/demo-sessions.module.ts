import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DemoEmailService } from './demo-email.service';
import { DemoSessionsController } from './demo-sessions.controller';
import { DemoSessionsService } from './demo-sessions.service';
import { DemoTokenService } from './demo-token.service';

@Global()
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DemoSessionsController],
  providers: [DemoSessionsService, DemoTokenService, DemoEmailService],
  exports: [DemoSessionsService, DemoTokenService, DemoEmailService],
})
export class DemoSessionsModule {}
