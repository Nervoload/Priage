import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { IntakeSessionsModule } from '../intake-sessions/intake-sessions.module';
import { AiTriageController } from './ai-triage.controller';
import { AiTriageService } from './ai-triage.service';
import { AnthropicTriageAdapter } from './providers/anthropic-triage.adapter';
import { OpenAiTriageAdapter } from './providers/openai-triage.adapter';
import { AiTriageSafetyService } from './safety/ai-triage-safety.service';
import { AiTriageStateStore } from './state/ai-triage-state.store';
import { AiTriageSummaryService } from './summary/ai-triage-summary.service';

@Module({
  imports: [AuthModule, IntakeSessionsModule],
  controllers: [AiTriageController],
  providers: [
    AiTriageService,
    AiTriageStateStore,
    AiTriageSafetyService,
    AiTriageSummaryService,
    OpenAiTriageAdapter,
    AnthropicTriageAdapter,
  ],
  exports: [AiTriageService],
})
export class AiTriageModule {}
