// backend/src/modules/encounters/dto/list-encounters.query.dto.ts
// list-encounters.query.dto.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// DTO for listing encounters with optional filters.

import { EncounterStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListEncountersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(EncounterStatus)
  status?: EncounterStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  hospitalId?: number;
}
