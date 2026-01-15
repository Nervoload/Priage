// backend/src/modules/alerts/dto/resolve-alert.dto.ts

import { IsInt } from 'class-validator';

export class ResolveAlertDto {
  @IsInt()
  actorUserId!: number;
}
