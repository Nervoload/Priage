import { Module } from '@nestjs/common';

import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PriageController } from './priage.controller';
import { PriageService } from './priage.service';

@Module({
  controllers: [PriageController],
  providers: [PriageService],
  imports: [EventsModule, PrismaModule],
})
export class PriageModule {}
