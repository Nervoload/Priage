// backend/src/modules/messaging/dto/create-message.dto.ts
// DTO for posting a message tied to an encounter.

import { SenderType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { Sanitize } from '../../../common/decorators/sanitize.decorator';

export class CreateMessageDto {
  @IsEnum(SenderType)
  senderType!: SenderType;

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
