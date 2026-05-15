// backend/src/modules/encounters/dto/create-admittance-encounter.dto.ts
// DTO for creating a new patient account + encounter from hospital admittance.

import { IsEmail, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

import { Sanitize, SanitizeEmail } from '../../../common/decorators/sanitize.decorator';

export class CreateAdmittanceEncounterDto {
  @IsEmail()
  @SanitizeEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Sanitize()
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Sanitize()
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Sanitize()
  phone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Sanitize()
  gender?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  @Sanitize()
  chiefComplaint!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Sanitize()
  details?: string;
}
