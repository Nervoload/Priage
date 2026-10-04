import { describe, expect, it } from 'vitest';
import { encounterPath, encounterStatusMeta, isActiveEncounter, isTerminalEncounter } from './encounters';

describe('encounter status metadata', () => {
  it('treats a clinic visit in Care as active, not past', () => {
    expect(isActiveEncounter('CARE')).toBe(true);
    expect(isTerminalEncounter('CARE')).toBe(false);
  });

  it('has patient-facing wording for Care', () => {
    expect(encounterStatusMeta('CARE').label).toBe('With your clinician');
  });

  it('shows neutral in-progress wording for a status this build does not know yet', () => {
    expect(encounterStatusMeta('DISCHARGE_PENDING').label).toBe('Visit in progress');
    expect(encounterStatusMeta('toString').label).toBe('Visit in progress');
    expect(isActiveEncounter('DISCHARGE_PENDING' as never)).toBe(true);
  });
});

describe('encounter path', () => {
  it('opens clinic visits on their clinic page and ED visits in the workspace', () => {
    expect(encounterPath({ id: 7, clinicAlias: 'riverside' })).toBe('/clinic/riverside/visits/7');
    expect(encounterPath({ id: 8, clinicAlias: null })).toBe('/encounters/8/current');
    expect(encounterPath({ id: 9 })).toBe('/encounters/9/current');
  });
});
