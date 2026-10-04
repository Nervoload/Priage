import { Module } from '@nestjs/common';

import { IntakeSessionsModule } from '../intake-sessions/intake-sessions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssessmentHarnessService } from './harness/assessment-harness.service';

/** The clinic assessment harness. See docs/AI_ASSESSMENT_HARNESS.md. */
@Module({
  imports: [PrismaModule, IntakeSessionsModule],
  providers: [AssessmentHarnessService],
  exports: [AssessmentHarnessService],
})
export class AssessmentModule {}
