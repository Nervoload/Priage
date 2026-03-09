// backend/src/modules/alerts/dto/create-alert.dto.ts

import { AlertSeverity } from '@prisma/client';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Sanitize } from '../../../common/decorators/sanitize.decorator';

export class CreateAlertDto {
  @IsInt()
  encounterId!: number;

  @IsString()
  @MaxLength(120)
  @Sanitize()
  type!: string;

  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
