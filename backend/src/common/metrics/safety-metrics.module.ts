import { Global, Module } from '@nestjs/common';

import { SafetyMetricsService } from './safety-metrics.service';

@Global()
@Module({
  providers: [SafetyMetricsService],
  exports: [SafetyMetricsService],
})
export class SafetyMetricsModule {}
