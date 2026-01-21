// backend/src/modules/encounters/dto/encounter-actor.dto.ts
// DTO for capturing actor identity on encounter transitions.

import { IsInt, IsOptional } from 'class-validator';

export class EncounterActorDto {
  @IsOptional()
  @IsInt()
  actorUserId?: number;

  @IsOptional()
  @IsInt()
  actorPatientId?: number;
}
