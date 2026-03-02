// backend/src/modules/intake/intake.module.ts

import { Module } from '@nestjs/common';

import { AssetsModule } from '../assets/assets.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';

@Module({
  controllers: [IntakeController],
  providers: [IntakeService],
  imports: [AssetsModule, EventsModule, PrismaModule],
})
export class IntakeModule {}
