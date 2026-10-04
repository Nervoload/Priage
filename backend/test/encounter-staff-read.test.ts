import { Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { EncountersController } from '../src/modules/encounters/encounters.controller';
import { EncountersService } from '../src/modules/encounters/encounters.service';

const logging = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
const request = { correlationId: 'corr-1' } as any;

function storedEncounter() {
  return {
    id: 81,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'ADMITTED',
    hospitalId: 4,
    patientId: 71,
    expectedAt: null,
    arrivedAt: new Date(),
    triagedAt: null,
    waitingAt: null,
    seenAt: null,
    departedAt: null,
    cancelledAt: null,
    chiefComplaint: 'Chest pain',
    details: 'Since this morning',
    currentCtasLevel: 2,
    currentPriorityScore: 90,
    contact: null,
    patient: {
      id: 71,
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '555-0100',
      age: 40,
      gender: 'F',
      heightCm: null,
      weightKg: null,
      allergies: 'penicillin',
      conditions: null,
      preferredLanguage: 'en',
      optionalHealthInfo: null,
    },
    summaryProjections: [],
    triageAssessments: [],
    events: [],
    messages: [],
    alerts: [],
    assets: [],
  };
}

describe('staff encounter writes', () => {
  // Each route delegates to the service method of the same name.
  it.each(['confirm', 'markArrived', 'createWaiting', 'startExam', 'discharge', 'cancel'] as const)("reads the %s result back with the caller's read context", async (route) => {
    const written = { id: 81, chiefComplaint: 'Chest pain' };
    const shaped = { id: 81, status: 'ADMITTED', clinicalFieldsRedacted: true };
    const service = {
      [route]: vi.fn(async () => written),
      readBackStaffWrite: vi.fn(async () => shaped),
    };
    const clinicalAccess = { assertClinicalEncounterAccess: vi.fn() };
    const controller = new EncountersController(service as any, clinicalAccess as any);
    const nurse = { userId: 9, hospitalId: 4, role: Role.NURSE };

    const result = await controller[route](81, request, nurse);

    expect(result).toBe(shaped);
    expect(service.readBackStaffWrite).toHaveBeenCalledWith(4, written, 'corr-1', { actorUserId: 9, role: Role.NURSE });
  });

  it('returns operational fields, not an error, when the read-back fails after the write committed', async () => {
    const prisma = { encounter: { findUnique: vi.fn(async () => { throw new Error('connection reset'); }) } };
    const service = new EncountersService(prisma as any, {} as any, logging as any, { record: vi.fn() } as any, {
      getClinicallyAccessibleEncounterIds: vi.fn(async () => new Set([81])),
    } as any);

    const result: any = await service.readBackStaffWrite(4, storedEncounter(), 'corr-1', { actorUserId: 9, role: Role.DOCTOR });

    expect(result).toMatchObject({ id: 81, status: 'ADMITTED', hospitalId: 4, clinicalFieldsRedacted: true });
    expect(result).not.toHaveProperty('chiefComplaint');
    expect(result).not.toHaveProperty('patient');
  });
});

describe('staff encounter read', () => {
  it('returns operational fields to a clinician outside the care team and audits the read', async () => {
    const prisma = { encounter: { findUnique: vi.fn(async () => storedEncounter()) } };
    const audit = { record: vi.fn() };
    const clinicalAccess = { getClinicallyAccessibleEncounterIds: vi.fn(async () => new Set<number>()) };
    const service = new EncountersService(prisma as any, {} as any, logging as any, audit as any, clinicalAccess as any);

    const result: any = await service.getEncounter(4, 81, 'corr-1', { actorUserId: 9, role: Role.NURSE });

    expect(result).not.toHaveProperty('chiefComplaint');
    expect(result.patient).toEqual({ id: 71, firstName: 'Ada', lastName: 'Lovelace' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'ENCOUNTER_DETAIL',
      actorUserId: 9,
      metadata: expect.objectContaining({ clinicalFieldsIncluded: false }),
    }));
  });

  it('returns clinical fields to a clinician on the care team', async () => {
    const prisma = { encounter: { findUnique: vi.fn(async () => storedEncounter()) } };
    const clinicalAccess = { getClinicallyAccessibleEncounterIds: vi.fn(async () => new Set([81])) };
    const service = new EncountersService(prisma as any, {} as any, logging as any, { record: vi.fn() } as any, clinicalAccess as any);

    const result: any = await service.getEncounter(4, 81, 'corr-1', { actorUserId: 9, role: Role.DOCTOR });

    expect(result.chiefComplaint).toBe('Chest pain');
    expect(result.patient.allergies).toBe('penicillin');
  });
});
