import { createRequire } from 'node:module';
import * as bcrypt from 'bcrypt';
import { describe, expect, it, vi } from 'vitest';

import { EncountersService } from '../src/modules/encounters/encounters.service';
import { normalizeHospitalConfig } from '../src/modules/hospitals/hospital-config';
import { HospitalsService } from '../src/modules/hospitals/hospitals.service';
import { PatientAuthService } from '../src/modules/patient-auth/patient-auth.service';

const require = createRequire(import.meta.url);
const { isStaffCreatedEvent, processStaffCreatedEncounter } = require('../scripts/backfill-staff-created-profiles.js');
const logging = { info: vi.fn(), error: vi.fn(), debug: vi.fn() };

describe('patient account boundary', () => {
  it('does not create a login account or claim an existing email for a staff visit', async () => {
    const tx = {
      patientProfile: { create: vi.fn(async ({ data }) => ({ id: 71, ...data })) },
      encounter: { create: vi.fn(async () => ({ id: 81, hospitalId: 4, status: 'EXPECTED' })) },
      encounterContact: { create: vi.fn() },
    };
    const prisma = { $transaction: (callback) => callback(tx) };
    const events = { emitEncounterEventTx: vi.fn(async () => ({ id: 91 })), dispatchEncounterEventAndMarkProcessed: vi.fn() };
    const service = new EncountersService(prisma as any, events as any, logging as any, {} as any, {} as any);
    vi.spyOn(service, 'getEncounter').mockResolvedValue({ id: 81 } as any);

    await service.createAdmittanceEncounter(4, { email: 'Patient@Example.ca', chiefComplaint: 'Checkup' });

    const profile = tx.patientProfile.create.mock.calls[0][0].data;
    expect(profile.accountEnabled).toBe(false);
    expect(profile.email).toMatch(/@intake\.local$/);
    expect(await bcrypt.compare('00000', profile.password)).toBe(false);
    expect(tx.encounterContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ encounterId: 81, hospitalId: 4, email: 'patient@example.ca' }),
    });
  });

  it('rejects disabled profiles and permits registered credentials', async () => {
    const hash = await bcrypt.hash('strong-password', 4);
    const prisma = {
      patientProfile: { findUnique: vi.fn(async () => ({ id: 4, email: 'patient@example.ca', password: hash, accountEnabled: false })) },
      patientSession: { findFirst: vi.fn(async () => null), create: vi.fn() },
    };
    const service = new PatientAuthService(prisma as any, logging as any);
    await expect(service.login({ email: 'patient@example.ca', password: 'strong-password' })).rejects.toThrow('Invalid email or password');
    expect(prisma.patientSession.create).not.toHaveBeenCalled();

    prisma.patientProfile.findUnique.mockResolvedValue({ id: 4, email: 'patient@example.ca', password: hash, accountEnabled: true });
    const result = await service.login({ email: 'patient@example.ca', password: 'strong-password' });
    expect(result.patient).not.toHaveProperty('password');
    expect(result.patient).not.toHaveProperty('accountEnabled');
    expect(prisma.patientSession.create).toHaveBeenCalledOnce();
  });

  it('marks registration, guest upgrade, and account deletion correctly', async () => {
    const tx = { patientSession: { deleteMany: vi.fn() }, patientProfile: { update: vi.fn() } };
    const prisma = {
      patientProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 4, email: 'patient@example.ca', password: await bcrypt.hash('strong-password', 4), accountEnabled: true })
          .mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 4, email: 'guest@intake.local', accountEnabled: false })
          .mockResolvedValueOnce(null),
        create: vi.fn(async ({ data }) => ({ id: 4, ...data })),
        update: vi.fn(async ({ data }) => ({ id: 4, ...data })),
      },
      patientSession: { create: vi.fn(), findUnique: vi.fn(async () => ({ encounterId: null })) },
      $transaction: (callback) => callback(tx),
    };
    const service = new PatientAuthService(prisma as any, logging as any);
    await service.register({ email: 'patient@example.ca', password: 'strong-password' } as any);
    expect(prisma.patientProfile.create.mock.calls[0][0].data.accountEnabled).toBe(true);
    await service.upgradeGuest(4, 9, { email: 'patient@example.ca', password: 'strong-password' } as any);
    expect(prisma.patientProfile.update.mock.calls[0][0].data.accountEnabled).toBe(true);
    await expect(service.deleteAccount(4, { email: 'PATIENT@example.ca', password: 'strong-password' })).rejects.toThrow('exact account email');
    await expect(service.deleteAccount(4, { email: '', password: 'strong-password' })).rejects.toThrow('exact account email');
    expect(tx.patientProfile.update).not.toHaveBeenCalled();
    await service.deleteAccount(4, { email: 'patient@example.ca', password: 'strong-password' });
    expect(tx.patientSession.deleteMany).toHaveBeenCalledWith({ where: { patientId: 4 } });
    expect(tx.patientProfile.update.mock.calls[0][0].data.accountEnabled).toBe(false);
    prisma.patientProfile.findUnique.mockResolvedValue({ id: 4, email: 'patient@example.ca', accountEnabled: false });
    await expect(service.deleteAccount(4, { email: 'patient@example.ca', password: 'strong-password' })).rejects.toThrow('Patient not found');
  });
});

describe('staff-created profile backfill', () => {
  it('recognizes only the tagged creation event', () => {
    expect(isStaffCreatedEvent({ createdFrom: 'hospital_admittance' })).toBe(true);
    expect(isStaffCreatedEvent({ source: 'patient_intake' })).toBe(false);
  });

  it('preserves the visit email, disables shared credentials, and leaves changed passwords for review', async () => {
    const oldHash = await bcrypt.hash('00000', 4);
    const changedHash = await bcrypt.hash('new-password', 4);
    const tx = {
      patientProfile: { findUniqueOrThrow: vi.fn(async () => ({ email: 'visit@example.ca', phone: '5551234567', password: oldHash })), update: vi.fn() },
      encounterContact: { create: vi.fn() },
      patientSession: { deleteMany: vi.fn() },
    };
    const prisma = { $transaction: (callback) => callback(tx) };
    const encounter = { id: 8, hospitalId: 3, patientId: 5, contact: null, patient: { email: 'visit@example.ca', password: oldHash, accountEnabled: true } };
    expect(await processStaffCreatedEncounter(prisma, encounter, false)).toBe('affected');
    expect(tx.patientProfile.update).not.toHaveBeenCalled();
    expect(await processStaffCreatedEncounter(prisma, encounter, true)).toBe('affected');
    expect(tx.encounterContact.create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: 'visit@example.ca', phone: '5551234567' }) });
    expect(tx.patientProfile.update.mock.calls[0][0].data.accountEnabled).toBe(false);
    expect(tx.patientProfile.update.mock.calls[0][0].data.email).toMatch(/@intake\.local$/);

    tx.patientProfile.update.mockClear();
    expect(await processStaffCreatedEncounter(prisma, { ...encounter, patient: { ...encounter.patient, password: changedHash } }, true)).toBe('manualReview');
    expect(tx.patientProfile.update).not.toHaveBeenCalled();
    expect(await processStaffCreatedEncounter(prisma, {
      ...encounter,
      patient: { ...encounter.patient, email: 'visit@intake.local', accountEnabled: false },
    }, true)).toBe('manualReview');
  });
});

describe('workflow configuration', () => {
  it('defaults legacy tenants to ED and preserves rollout fields on staff settings saves', async () => {
    const defaultConfig = normalizeHospitalConfig({ version: 1 });
    expect(defaultConfig.workflowProfile).toBe('ED');

    const config = { ...defaultConfig, workflowProfile: 'CLINIC_APPOINTMENT', futureSetting: { enabled: true } };
    const prisma = {
      hospitalConfig: {
        findUnique: vi.fn(async () => ({ config })),
        upsert: vi.fn(async () => ({ updatedAt: new Date('2026-09-26T00:00:00Z') })),
      },
    };
    const service = new HospitalsService(prisma as any, logging as any, {} as any, {} as any);
    vi.spyOn(service as any, 'assertHospitalExists').mockResolvedValue(undefined);
    await service.updateConfig(3, {
      pageAccess: defaultConfig.pageAccess,
      customIntakeQuestions: defaultConfig.customIntakeQuestions,
      admittanceFeedbackSurvey: defaultConfig.admittanceFeedbackSurvey,
    } as any);
    const stored = prisma.hospitalConfig.upsert.mock.calls[0][0].update.config;
    expect(stored.workflowProfile).toBe('CLINIC_APPOINTMENT');
    expect(stored.futureSetting).toEqual({ enabled: true });
  });
});
