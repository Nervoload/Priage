// Partner-facing external API module.
// Owns the /platform/v1 integration surface for external software systems.
// Partner auth, scopes, idempotency, and trust-policy handling stay here.

import { Module } from '@nestjs/common';

import { AssetsModule } from '../assets/assets.module';
import { EventsModule } from '../events/events.module';
import { IntakeSessionsModule } from '../intake-sessions/intake-sessions.module';
import { LoggingModule } from '../logging/logging.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformController } from './platform.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PartnerAuthGuard } from './guards/partner-auth.guard';
import { PlatformService } from './platform.service';

@Module({
  imports: [PrismaModule, LoggingModule, AssetsModule, IntakeSessionsModule, EventsModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformAuthService, PartnerAuthGuard],
  exports: [PlatformAuthService],
})
export class PlatformModule {}
