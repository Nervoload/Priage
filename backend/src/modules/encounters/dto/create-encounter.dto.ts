// backend/src/modules/encounters/dto/create-encounter.dto.ts
// create-encounter.dto.ts

// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Jan 6 2026

// DTO for creating an encounter from the patient app intake.
// For prototype: hospitalName is a string; later switch to hospitalId or hospitalSlug.

import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEncounterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  patientDisplayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  patientPhone?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  hospitalName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  chiefComplaint!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  details?: string;
}
