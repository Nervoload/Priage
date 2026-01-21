// backend/src/modules/logging/logging.module.ts
// Module definition for centralized logging

import { Module, Global } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { ErrorReportService } from './error-report.service';
import { LoggingController } from './logging.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Global() // Make available everywhere without explicit import
@Module({
  imports: [PrismaModule, RealtimeModule],
  providers: [LoggingService, ErrorReportService],
  controllers: [LoggingController],
  exports: [LoggingService, ErrorReportService],
})
export class LoggingModule {}
