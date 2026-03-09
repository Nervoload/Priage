// backend/src/modules/logging/logging.module.ts
// Module definition for centralized logging

import { Module, Global, forwardRef } from '@nestjs/common';
import { CorrelationLogBufferService } from './correlation-log-buffer.service';
import { LoggingService } from './logging.service';
import { ErrorReportService } from './error-report.service';
import { LoggingController } from './logging.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Global() // Make available everywhere without explicit import
@Module({
  imports: [forwardRef(() => PrismaModule), forwardRef(() => RealtimeModule)],
  providers: [CorrelationLogBufferService, LoggingService, ErrorReportService],
  controllers: [LoggingController],
  exports: [LoggingService, ErrorReportService],
})
export class LoggingModule {}
