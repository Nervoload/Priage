import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClinicPilotService } from '../src/modules/clinic/clinic-pilot.service';
import { PilotRouteBoundaryGuard } from '../src/modules/clinic/pilot-route-boundary.guard';
import { PriageService } from '../src/modules/priage/priage.service';
import { TriageService } from '../src/modules/triage/triage.service';

afterEach(() => vi.unstubAllEnvs());

describe('dedicated clinic deployment boundary', () => {
  it('fails startup for a non-clinic pin and refuses externally configured preview interviews', async () => {
    vi.stubEnv('PILOT_CLINIC_ID', '2');
    vi.stubEnv('CLINIC_PREVIEW_ENABLED', 'true');
    vi.stubEnv('TRIAGE_INTERVIEW_MODE', 'deterministic');
    const prisma = { hospital: { findUnique: vi.fn(async () => ({ id: 2, config: { config: { workflowProfile: 'ED' } } })) } };
    await expect(new ClinicPilotService(prisma as never).onModuleInit()).rejects.toThrow('CLINIC_APPOINTMENT');
    prisma.hospital.findUnique.mockResolvedValue({ id: 2, config: { config: { workflowProfile: 'CLINIC_APPOINTMENT' } } });
    await expect(new ClinicPilotService(prisma as never).onModuleInit()).resolves.toBeUndefined();
    vi.stubEnv('TRIAGE_INTERVIEW_MODE', 'external');
    expect(() => new ClinicPilotService(prisma as never)).toThrow('deterministic');
  });

  it('keeps clinic intake inactive without the explicit server preview gate', () => {
    vi.stubEnv('PILOT_CLINIC_ID', '2');
    vi.stubEnv('CLINIC_PREVIEW_ENABLED', 'false');
    const pilot = new ClinicPilotService({} as never);
    expect(() => pilot.assertPreviewEnabled()).toThrow();
  });

  it('blocks legacy ED write paths on a pilot deployment while leaving clinic routes available', () => {
    const guard = new PilotRouteBoundaryGuard({ hospitalId: 2 } as never);
    const request = (path: string, method = 'POST') => ({ switchToHttp: () => ({ getRequest: () => ({ path, method }) }) }) as never;
    expect(() => guard.canActivate(request('/intake/intent'))).toThrow();
    expect(() => guard.canActivate(request('/encounters/admit'))).toThrow();
    expect(() => guard.canActivate(request('/platform/v1/intake-sessions/abc/confirm'))).toThrow();
    expect(() => guard.canActivate(request('/triage/assessments'))).toThrow();
    expect(guard.canActivate(request('/clinic-intake/visits/guest'))).toBe(true);
    expect(guard.canActivate(request('/encounters', 'GET'))).toBe(true);
  });

  it('returns only the pinned clinic and omits clinic tenants from ED directories', async () => {
    const hospitals = [
      { id: 1, name: 'ED', slug: 'ed', config: null },
      { id: 2, name: 'Clinic', slug: 'clinic', config: { config: { workflowProfile: 'CLINIC_APPOINTMENT' } } },
    ];
    const prisma = { hospital: { findMany: vi.fn(async ({ where }) => where?.id ? hospitals.filter((hospital) => hospital.id === where.id) : hospitals) } };
    const entry = { settings: vi.fn(async () => ({ canonicalAlias: 'clinic-2', acceptsWalkIns: true })) };
    const ed = new PriageService(prisma as never, { hospitalId: null, previewEnabled: false, previewTenantIds: new Set() } as never, entry as never);
    expect((await ed.listHospitals()).map((hospital) => hospital.id)).toEqual([1]);
    const pilot = new PriageService(prisma as never, { hospitalId: 2, previewEnabled: false } as never, entry as never);
    expect((await pilot.listHospitals()).map((hospital) => hospital.id)).toEqual([2]);
  });

  it('rejects ED triage writes for a clinic tenant even on an unpinned deployment', async () => {
    const prisma = {
      $transaction: (callback: (tx: unknown) => unknown) => callback({
        hospital: { findUnique: async () => ({ config: { config: { workflowProfile: 'CLINIC_APPOINTMENT' } } }) },
      }),
    };
    const service = new TriageService(prisma as never, {} as never, {
      info: vi.fn(), error: vi.fn(),
    } as never, {} as never);
    await expect(service.createAssessment({ encounterId: 1, ctasLevel: 3 } as never, 2, 1))
      .rejects.toThrow('unavailable for clinic encounters');
  });
});
