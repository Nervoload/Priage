// backend/src/modules/messaging/dto/create-patient-message.dto.ts
// DTO for patient-sent messages.

import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

import { Sanitize } from '../../../common/decorators/sanitize.decorator';
import { ASSET_MAX_FILES_PER_REQUEST } from '../../assets/assets.constants';

export class CreatePatientMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Sanitize()
  content?: string;

  /**
   * If true, creates a HIGH severity PATIENT_WORSENING alert for staff.
   */
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
