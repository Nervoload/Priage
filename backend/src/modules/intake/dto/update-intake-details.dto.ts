// backend/src/modules/intake/dto/update-intake-details.dto.ts

import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Sanitize } from '../../../common/decorators/sanitize.decorator';

export class UpdateIntakeDetailsDto {
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
  @MaxLength(120)
  @Sanitize()
  allergies?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Sanitize()
  conditions?: string;
}
