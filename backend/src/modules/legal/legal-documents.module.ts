import { Module } from '@nestjs/common';

import { LegalDocumentsService } from './legal-documents.service';

@Module({
  providers: [LegalDocumentsService],
  exports: [LegalDocumentsService],
})
export class LegalDocumentsModule {}
