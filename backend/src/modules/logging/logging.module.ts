// backend/src/modules/logging/logging.module.ts
// Module definition for centralized logging

import { Module, Global } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { ErrorReportService } from './error-report.service';
import { LoggingController } from './logging.controller';
import { LogRepositoryService } from './log-repository.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Global() // Make available everywhere without explicit import
@Module({
  imports: [PrismaModule, RealtimeModule],
  providers: [
    LogRepositoryService,
    {
      provide: 'LOG_REPOSITORY',
      useExisting: LogRepositoryService,
    },
    LoggingService,
    ErrorReportService,
  ],
  controllers: [LoggingController],
  exports: [LoggingService, ErrorReportService],
})
export class LoggingModule {}
