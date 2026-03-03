// backend/src/modules/intake/dto/create-intent.dto.ts

import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

import { Sanitize } from '../../../common/decorators/sanitize.decorator';

export class CreateIntentDto {
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
  @IsInt()
  @Min(0)
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  @Sanitize()
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Sanitize()
  details?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(5)
  @Sanitize()
  preferredLanguage?: string;
}
