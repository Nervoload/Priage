// backend/src/modules/demo-access/demo-access.module.ts

import { Module } from '@nestjs/common';
import { DemoAccessController } from './demo-access.controller';

@Module({
  controllers: [DemoAccessController],
})
export class DemoAccessModule {}
