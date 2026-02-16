// backend/src/modules/triage/dto/create-triage-assessment.dto.ts

import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class VitalSignsDto {
  @IsOptional()
  @IsString()
  bloodPressure?: string; // e.g. "120/80"

  @IsOptional()
  @IsNumber()
  heartRate?: number;

  @IsOptional()
  @IsNumber()
  temperature?: number; // °C

  @IsOptional()
  @IsNumber()
  respiratoryRate?: number;

  @IsOptional()
  @IsNumber()
  oxygenSaturation?: number; // %
}

export class CreateTriageAssessmentDto {
  @IsInt()
  encounterId!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  ctasLevel!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  chiefComplaint?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painLevel?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => VitalSignsDto)
  vitalSigns?: VitalSignsDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
