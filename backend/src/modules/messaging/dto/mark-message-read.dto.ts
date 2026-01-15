// backend/src/modules/messaging/dto/mark-message-read.dto.ts
// DTO for marking a message as read (optional audit event).

import { IsInt } from 'class-validator';

export class MarkMessageReadDto {
  @IsInt()
  actorUserId!: number;
}
