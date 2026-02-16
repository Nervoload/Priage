// backend/src/modules/encounters/dto/list-encounters.query.dto.ts
// list-encounters.query.dto.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Feb 12 2026
// DTO for listing encounters with status + date filtering.
// Replaces pagination with practical filters for an ER dashboard.

import { EncounterStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListEncountersQueryDto {
  /** Filter by one or more statuses (e.g. ?status=TRIAGE&status=WAITING) */
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(EncounterStatus, { each: true })
  status?: EncounterStatus[];

  /** Only return encounters created on or after this date */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  since?: Date;

  /** Maximum number of results to return (default 200, max 500) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 200;
}
