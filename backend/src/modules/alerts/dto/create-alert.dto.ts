// backend/src/modules/alerts/dto/create-alert.dto.ts

import { AlertSeverity } from '@prisma/client';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAlertDto {
  @IsInt()
  encounterId!: number;

  @IsInt()
  hospitalId!: number;

  @IsString()
  @MaxLength(120)
  type!: string;

  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsInt()
  actorUserId!: number;
}
