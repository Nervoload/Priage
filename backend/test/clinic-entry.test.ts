import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClinicEntryService } from '../src/modules/clinic/clinic-entry.service';
import { ClinicPilotService } from '../src/modules/clinic/clinic-pilot.service';
import { PriageService } from '../src/modules/priage/priage.service';

const CLINIC_CONFIG = { config: { workflowProfile: 'CLINIC_APPOINTMENT' } };

describe('clinic entry policy', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses only the server allowlist and verifies clinic profiles at startup', async () => {
    vi.stubEnv('PILOT_CLINIC_ID', '');
    vi.stubEnv('CLINIC_PREVIEW_TENANT_IDS', '2');
    vi.stubEnv('CLINIC_PREVIEW_ENABLED', 'true');
    vi.stubEnv('NODE_ENV', 'test');
    const prisma = { hospital: { findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
      where.id === 2 ? { id: 2, config: CLINIC_CONFIG } : { id: where.id, config: null }) } };
    const pilot = new ClinicPilotService(prisma as never);
    await pilot.onModuleInit();
    expect(pilot.assertTenantEnabled(2)).toBe(2);
    expect(() => pilot.assertTenantEnabled(3)).toThrow();
    vi.stubEnv('CLINIC_PREVIEW_TENANT_IDS', '3');
    await expect(new ClinicPilotService(prisma as never).onModuleInit()).rejects.toThrow('CLINIC_APPOINTMENT');
  });
  it('keeps unlisted clinics out of general search while resolving their direct links', async () => {
    const hospitals = [
      { id: 1, name: 'ED', slug: 'ed', config: null, clinicEntrySettings: null },
      { id: 2, name: 'Listed', slug: 'listed', config: CLINIC_CONFIG, clinicEntrySettings: { canonicalAlias: 'listed', directoryListed: true, acceptsWalkIns: true } },
      { id: 3, name: 'Private', slug: 'private', config: CLINIC_CONFIG, clinicEntrySettings: { canonicalAlias: 'private', directoryListed: false, acceptsWalkIns: false } },
    ];
    const pilot = { hospitalId: null, previewEnabled: true, previewTenantIds: new Set([2, 3]), assertTenantEnabled: vi.fn((id: number) => id) };
    const prisma = {
      hospital: { findMany: vi.fn(async () => hospitals) },
      clinicEntryAlias: { findUnique: vi.fn(async ({ where }: { where: { alias: string } }) => {
        const row = hospitals.find((item) => item.clinicEntrySettings?.canonicalAlias === where.alias);
        return row ? { hospitalId: row.id, hospital: { ...row } } : null;
      }) },
      clinicSchedule: { findUnique: vi.fn(async () => ({ hospitalId: 2 })) },
      legalDocumentVersion: { findFirst: vi.fn(async () => ({ id: 1 })) },
    };
    const entry = new ClinicEntryService(prisma as never, pilot as never);
    const directory = new PriageService(prisma as never, pilot as never, entry);
    expect((await directory.listHospitals()).map((row) => row.id)).toEqual([1, 2]);
    expect((await entry.resolve('private')).startPath).toBe('/private/start');
  });

  it('rejects an alias from another tenant and an appointment-only walk-in', async () => {
    const settings = { hospitalId: 2, canonicalAlias: 'clinic-two', directoryListed: false, acceptsWalkIns: false, updatedAt: new Date() };
    const prisma = {
      hospital: { findUnique: vi.fn(async () => ({ id: 2, name: 'Clinic', config: CLINIC_CONFIG })) },
      clinicEntrySettings: { findUnique: vi.fn(async () => settings) },
      clinicEntryAlias: { findUnique: vi.fn(async () => ({ alias: 'taken', hospitalId: 3 })) },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
        $executeRaw: vi.fn(),
        clinicEntryAlias: { findUnique: vi.fn(async () => ({ alias: 'taken', hospitalId: 3 })) },
      })),
    };
    const service = new ClinicEntryService(prisma as never, { assertTenantEnabled: (id: number) => id } as never);
    await expect(service.assertWalkIns(2)).rejects.toThrow('appointments only');
    await expect(service.update(2, { canonicalAlias: 'taken', directoryListed: true, acceptsWalkIns: true })).rejects.toThrow('already in use');
  });
});
