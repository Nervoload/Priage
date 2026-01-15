// backend/src/modules/alerts/dto/ack-alert.dto.ts

import { IsInt } from 'class-validator';

export class AckAlertDto {
  @IsInt()
  actorUserId!: number;
}
