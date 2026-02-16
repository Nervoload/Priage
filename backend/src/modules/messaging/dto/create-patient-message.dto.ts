// backend/src/modules/messaging/dto/create-patient-message.dto.ts
// DTO for patient-sent messages.

import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { Sanitize } from '../../../common/decorators/sanitize.decorator';

export class CreatePatientMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Sanitize()
  content!: string;

  /**
   * If true, creates a HIGH severity PATIENT_WORSENING alert for staff.
   */
  @IsOptional()
  @IsBoolean()
  isWorsening?: boolean;
}
