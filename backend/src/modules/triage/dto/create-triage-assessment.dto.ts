// backend/src/modules/triage/dto/create-triage-assessment.dto.ts

import { IsInt, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';

export class CreateTriageAssessmentDto {
  @IsInt()
  encounterId!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  ctasLevel!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
