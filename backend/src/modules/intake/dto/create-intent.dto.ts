// backend/src/modules/intake/dto/create-intent.dto.ts

import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateIntentDto {
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
  @MaxLength(240)
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  details?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(5)
  preferredLanguage?: string;
}
