// backend/src/modules/encounters/dto/create-message.dto.ts
// create-message.dto.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// DTO for posting a message tied to an encounter.
// "from" is intentionally limited to PATIENT/STAFF for the prototype.

import { MessageAuthor } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsEnum(MessageAuthor)
  from!: MessageAuthor;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
