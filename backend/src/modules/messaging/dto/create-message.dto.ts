// backend/src/modules/messaging/dto/create-message.dto.ts
// DTO for posting a message tied to an encounter.

import { SenderType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { Sanitize } from '../../../common/decorators/sanitize.decorator';

export class CreateMessageDto {
  @IsEnum(SenderType)
  senderType!: SenderType;

  @IsOptional()
  @IsInt()
  createdByUserId?: number;

  @IsOptional()
  @IsInt()
  createdByPatientId?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Sanitize()
  content!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @IsOptional()
  @IsBoolean()
  isWorsening?: boolean;
}
