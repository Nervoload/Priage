// backend/src/modules/encounters/dto/list-encounters.query.dto.ts
// list-encounters.query.dto.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// DTO for listing encounters with optional filters.

import { EncounterStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional } from 'class-validator';

export class ListEncountersQueryDto {
  @IsOptional()
  @IsEnum(EncounterStatus)
  status?: EncounterStatus;

  @IsOptional()
  @IsInt()
  hospitalId?: number;
}
