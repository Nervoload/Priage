import { EncounterStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { isActiveEncounterStatus, isTerminalEncounterStatus } from '../src/shared/types/encounter-status';

describe('encounter status groupings', () => {
  it('puts every status in exactly one of active or terminal', () => {
    for (const status of Object.values(EncounterStatus)) {
      expect(isActiveEncounterStatus(status)).toBe(!isTerminalEncounterStatus(status));
    }
    expect(Object.values(EncounterStatus).filter(isTerminalEncounterStatus)).toEqual(['COMPLETE', 'UNRESOLVED', 'CANCELLED']);
  });

  it('treats a clinic visit in Care as active', () => {
    expect(isActiveEncounterStatus(EncounterStatus.CARE)).toBe(true);
  });
});
