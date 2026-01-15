// backend/src/modules/assets/assets.module.ts

import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService],
  imports: [PrismaModule],
})
export class AssetsModule {}
