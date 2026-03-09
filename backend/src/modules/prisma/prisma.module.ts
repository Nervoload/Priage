// backend/src/modules/prisma/prisma.module.ts
// prisma.module.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Provides PrismaService (injectable Prisma client) app-wide.

import { Global, Module, forwardRef } from '@nestjs/common';

import { LoggingModule } from '../logging/logging.module';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [forwardRef(() => LoggingModule)],
  providers: [
    {
      provide: PrismaService,
      inject: [LoggingService],
      useFactory: (loggingService: LoggingService) => {
        const prismaService = new PrismaService();
        prismaService.setLoggingService(loggingService);
        return prismaService;
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
