import { Global, Module } from '@nestjs/common';

import { ClinicalAccessController } from './clinical-access.controller';
import { ClinicalAccessService } from './clinical-access.service';

@Global()
@Module({
  controllers: [ClinicalAccessController],
  providers: [ClinicalAccessService],
  exports: [ClinicalAccessService],
})
export class ClinicalAccessModule {}

