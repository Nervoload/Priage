// backend/src/modules/analytics/analytics.module.ts
// Analytics module wiring.

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LoggingModule } from '../logging/logging.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [AuthModule, PrismaModule, LoggingModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
