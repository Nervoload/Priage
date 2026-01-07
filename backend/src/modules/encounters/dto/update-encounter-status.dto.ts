// backend/src/modules/encounters/dto/update-encounter-status.dto.ts
// update-encounter-status.dto.ts

// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Jan 6 2026

// DTO for updating encounter status.

import { EncounterStatus } from '../../../../generated/prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateEncounterStatusDto {
  @IsEnum(EncounterStatus)
  status!: EncounterStatus;
}
