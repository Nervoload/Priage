// backend/src/modules/demo-access/demo-access.module.ts

import { Module } from '@nestjs/common';
import { DemoSessionsModule } from '../demo-sessions/demo-sessions.module';
import { DemoAccessController } from './demo-access.controller';

@Module({
  imports: [DemoSessionsModule],
  controllers: [DemoAccessController],
})
export class DemoAccessModule {}
