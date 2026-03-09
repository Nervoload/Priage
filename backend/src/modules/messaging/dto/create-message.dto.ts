// backend/src/modules/messaging/dto/create-message.dto.ts
// DTO for posting a message tied to an encounter.

import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

import { Sanitize } from '../../../common/decorators/sanitize.decorator';
import { ASSET_MAX_FILES_PER_REQUEST } from '../../assets/assets.constants';

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Sanitize()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @IsOptional()
  @IsBoolean()
  isWorsening?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ASSET_MAX_FILES_PER_REQUEST)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  assetIds?: number[];
}
