// backend/src/modules/intake/dto/confirm-intent.dto.ts

import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmIntentDto {
  @IsOptional()
  @IsInt()
  hospitalId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  hospitalSlug?: string;
}
