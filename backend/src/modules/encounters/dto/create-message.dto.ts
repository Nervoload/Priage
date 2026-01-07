// backend/src/modules/encounters/dto/create-message.dto.ts
// create-message.dto.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// DTO for posting a message tied to an encounter.
// "from" is a string for prototype ("PATIENT" | "STAFF"); later replace with structured identity.

import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsIn(['PATIENT', 'STAFF'])
  from!: 'PATIENT' | 'STAFF';

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
