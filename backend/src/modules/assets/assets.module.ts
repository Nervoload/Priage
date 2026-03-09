// backend/src/modules/assets/assets.module.ts

import { Module, forwardRef } from '@nestjs/common';

import { IntakeSessionsModule } from '../intake-sessions/intake-sessions.module';
import { LoggingModule } from '../logging/logging.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetStorageService } from './asset-storage.service';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { PatientAssetsController } from './patient-assets.controller';

@Module({
  controllers: [AssetsController, PatientAssetsController],
  providers: [AssetsService, AssetStorageService],
  imports: [PrismaModule, LoggingModule, forwardRef(() => IntakeSessionsModule)],
  exports: [AssetsService],
})
export class AssetsModule {}
