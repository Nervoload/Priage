// backend/src/modules/intake/dto/update-intake-details.dto.ts

import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateIntakeDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  details?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  allergies?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  conditions?: string;
}
