// backend/src/modules/encounters/dto/update-encounter.dto.ts


import { EncounterStatus } from '@prisma/client';

export class UpdateEncounterStatusDto {
  status: EncounterStatus;
}
