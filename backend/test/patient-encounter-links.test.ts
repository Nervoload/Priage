import { describe, expect, it, vi } from 'vitest';

import { EncountersService } from '../src/modules/encounters/encounters.service';

const logging = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

function visitAt(id: number, workflowProfile: string, canonicalAlias: string | null) {
  return {
    id,
    status: 'REQUESTED',
    hospital: {
      config: { config: { workflowProfile } },
      clinicEntrySettings: canonicalAlias ? { canonicalAlias } : null,
    },
  };
}

describe('patient encounter list', () => {
  it('links clinic visits to their clinic page and leaves ED visits in the workspace', async () => {
    const prisma = {
      encounter: {
        findMany: vi.fn(async () => [
          visitAt(1, 'CLINIC_APPOINTMENT', 'riverside'),
          visitAt(2, 'ED', null),
          visitAt(3, 'CLINIC_APPOINTMENT', null),
        ]),
      },
    };
    const service = new EncountersService(prisma as any, {} as any, logging as any, {} as any, {} as any);

    const visits = await service.listEncountersForPatient(71);

    expect(visits.map((visit) => visit.clinicAlias)).toEqual(['riverside', null, null]);
    expect(visits[0]).not.toHaveProperty('hospital');
  });
});
