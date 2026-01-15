// backend/src/modules/encounters/dto/create-encounter.dto.ts
// create-encounter.dto.ts

// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Jan 6 2026

// DTO for creating an encounter from staff tooling or intake confirmations.

import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEncounterDto {
  @IsInt()
  patientId!: number;

  @IsInt()
  hospitalId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  chiefComplaint!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  details?: string;
}
