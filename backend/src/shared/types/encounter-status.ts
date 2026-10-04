// backend/src/shared/types/encounter-status.ts
// Encounter status groupings shared across the backend. The statuses themselves
// come from the Prisma schema (`EncounterStatus` in @prisma/client).

import { EncounterStatus } from '@prisma/client';

/** Statuses after which a visit is over. */
export const TERMINAL_ENCOUNTER_STATUSES: EncounterStatus[] = [
  EncounterStatus.COMPLETE,
  EncounterStatus.UNRESOLVED,
  EncounterStatus.CANCELLED,
];

/** An active visit is any status that is not terminal, so new statuses count as active by default. */
export const ACTIVE_ENCOUNTER_STATUSES: EncounterStatus[] = Object.values(EncounterStatus).filter(
  (status) => !TERMINAL_ENCOUNTER_STATUSES.includes(status),
);

export function isTerminalEncounterStatus(status: EncounterStatus): boolean {
  return TERMINAL_ENCOUNTER_STATUSES.includes(status);
}

export function isActiveEncounterStatus(status: EncounterStatus): boolean {
  return !isTerminalEncounterStatus(status);
}
