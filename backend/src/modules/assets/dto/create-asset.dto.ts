// backend/src/modules/assets/dto/create-asset.dto.ts

import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAssetDto {
  @IsInt()
  encounterId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  storageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sha256?: string;
}
