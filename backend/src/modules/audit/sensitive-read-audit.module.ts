import { Global, Module } from '@nestjs/common';

import { LoggingModule } from '../logging/logging.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SensitiveReadAuditService } from './sensitive-read-audit.service';

@Global()
@Module({
  imports: [PrismaModule, LoggingModule],
  providers: [SensitiveReadAuditService],
  exports: [SensitiveReadAuditService],
})
export class SensitiveReadAuditModule {}
