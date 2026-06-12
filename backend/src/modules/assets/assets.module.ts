// backend/src/modules/assets/assets.module.ts

import { Module, forwardRef } from '@nestjs/common';

import { IntakeSessionsModule } from '../intake-sessions/intake-sessions.module';
import { LoggingModule } from '../logging/logging.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetStorageService } from './asset-storage.service';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { PatientAssetsController } from './patient-assets.controller';
import { AssetScanService } from './asset-scan.service';

@Module({
  controllers: [AssetsController, PatientAssetsController],
  providers: [AssetsService, AssetStorageService, AssetScanService],
  imports: [PrismaModule, LoggingModule, forwardRef(() => IntakeSessionsModule)],
  exports: [AssetsService, AssetStorageService],
})
export class AssetsModule {}
