import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { CLINIC_HANDOFF_RULES_VERSION } from '../src/modules/clinic/care/clinic-handoff.rules';
import { ClinicCareService } from '../src/modules/clinic/clinic-care.service';
import { SAFETY_GATE_PUBLIC_ID } from '../src/modules/intake/interview/triage-interview.types';

const safetyAnswer = { questionPublicId: SAFETY_GATE_PUBLIC_ID, prompt: 'Are you in immediate danger right now?', phase: 'urgent', inputType: 'boolean', answeredAt: '2026-10-03T14:01:00.000Z', answerText: 'No', valueBoolean: false };
const v1Content = { interviewStatus: 'complete', generatedAt: null, generationMode: 'fallback', provider: null, governanceVersion: null, summary: { briefing: 'old', caseSummary: '', recommendedAction: '', redFlags: [], progressionRisks: [] }, answers: [], unasked: [], segments: [] };

function careService(prisma: unknown = {}) {
  const pilot = { assertTenantEnabled: vi.fn() };
  const access = { getClinicallyAccessibleEncounterIds: vi.fn(async (_staff: unknown, ids: number[]) => new Set(ids)), assertClinicalEncounterAccess: vi.fn() };
  const audit = { record: vi.fn() };
  const events = { emitEncounterEventTx: vi.fn(async () => ({ id: 1 })), dispatchEncounterEventAndMarkProcessed: vi.fn(async () => undefined) };
  const questionnaire = { activeVersion: vi.fn(async () => null), statusForIntakes: vi.fn(async (_hospitalId: number, _states: unknown, ids: number[]) => new Map(ids.map((id) => [id, 'none']))) };
  return { service: new ClinicCareService(prisma as never, pilot as never, access as never, audit as never, events as never, {} as never, questionnaire as never), audit, events };
}

function snapshotTx(options: { existing: unknown; status: string; complete: boolean }) {
  return {
    $executeRaw: vi.fn(),
    careAssessmentSnapshot: {
      findFirst: vi.fn(async () => options.existing),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 99, ...data })),
    },
    intakeSession: { findFirst: vi.fn(async () => ({ id: 11 })) },
    encounter: { findUniqueOrThrow: vi.fn(async () => ({ status: options.status, chiefComplaint: 'Sore throat', patient: { age: 34, gender: 'F', allergies: null, conditions: null } })) },
    contextItem: {
      findMany: vi.fn(async ({ where }: { where: { itemType: string } }) => where.itemType === 'ai_interview_state'
        ? [{ createdAt: new Date('2026-10-03T14:00:00Z'), supersededBy: [], payload: { status: options.complete ? 'complete' : 'in_progress', askedCount: 0, maxQuestions: 12, answers: [safetyAnswer] } }]
        : [{ payload: safetyAnswer, answerEntryMode: 'PATIENT_SELF', enteredByUserId: null }]),
      findFirst: vi.fn(async () => ({ payload: { chiefComplaint: 'Sore throat', details: 'Since Sunday' } })),
    },
    summaryProjection: { findFirst: vi.fn(async () => null) },
  };
}

const ensureSnapshot = (service: ClinicCareService, tx: unknown, allowPartial = false) =>
  (service as unknown as { ensureSnapshot: (tx: unknown, encounterId: number, hospitalId: number, allowPartial: boolean) => Promise<{ version?: number; partial?: boolean; content?: { schemaVersion?: number } } | null> })
    .ensureSnapshot(tx, 7, 4, allowPartial);

describe('Care snapshot versions', () => {
  it('replaces an older snapshot while the visit is still waiting for Care', async () => {
    const { service } = careService();
    const tx = snapshotTx({ existing: { id: 1, version: 1, partial: false, content: v1Content }, status: 'ADMITTED', complete: true });
    const snapshot = await ensureSnapshot(service, tx);
    expect(tx.careAssessmentSnapshot.create).toHaveBeenCalledOnce();
    expect(snapshot).toMatchObject({ version: 2, partial: false, content: { schemaVersion: 2 } });
  });

  it('keeps the snapshot comments may point at once Care has started', async () => {
    const { service } = careService();
    const existing = { id: 1, version: 1, partial: false, content: v1Content };
    const tx = snapshotTx({ existing, status: 'CARE', complete: true });
    expect(await ensureSnapshot(service, tx)).toBe(existing);
    expect(tx.careAssessmentSnapshot.create).not.toHaveBeenCalled();
  });

  it('keeps a current snapshot', async () => {
    const { service } = careService();
    const existing = { id: 1, version: 3, partial: false, content: { schemaVersion: 2, handoffGenerator: { rulesVersion: CLINIC_HANDOFF_RULES_VERSION } } };
    const tx = snapshotTx({ existing, status: 'ADMITTED', complete: true });
    expect(await ensureSnapshot(service, tx)).toBe(existing);
  });

  it('builds a partial snapshot only for an urgent start', async () => {
    const { service } = careService();
    const tx = snapshotTx({ existing: null, status: 'ADMITTED', complete: false });
    expect(await ensureSnapshot(service, tx)).toBeNull();
    expect(await ensureSnapshot(service, tx, true)).toMatchObject({ version: 1, partial: true, content: { schemaVersion: 2 } });
  });
});

describe('Care queue', () => {
  it('adds briefing, urgency, red flags and the emergency marker to each row', async () => {
    const prisma = {
      encounter: {
        findMany: vi.fn(async () => [{
          id: 7, patientId: 3, status: 'ADMITTED', chiefComplaint: 'Sore throat', arrivedAt: null, seenAt: null, departedAt: null,
          patient: { firstName: 'Maya', lastName: 'Chen', age: 34, gender: 'F', allergies: null, conditions: null },
          intakeSessions: [{ id: 11 }],
        }]),
      },
      contextItem: {
        findMany: vi.fn(async ({ where }: { where: { itemType: string } }) => where.itemType === 'ai_interview_state'
          ? [{ intakeSessionId: 11, payload: { status: 'complete', emergencyAcknowledged: true, askedCount: 0, maxQuestions: 12, answers: [{ ...safetyAnswer, answerText: 'Yes', valueBoolean: true }] } }]
          : [{ intakeSessionId: 11, payload: { chiefComplaint: 'Sore throat', details: null } }]),
      },
    };
    const { service, audit } = careService(prisma);
    const [row] = await service.queue({ userId: 1, hospitalId: 4, role: 'DOCTOR' as never });
    expect(row).toMatchObject({
      patientName: 'Maya Chen', assessmentStatus: 'complete', redFlagCount: 1,
      urgency: { level: 'escalate', sentence: 'Escalate: possible emergency signs' },
      emergency: { shown: true, acknowledged: true },
    });
    expect(row.briefing).toMatch(/^34-year-old female with “Sore throat”/);
    expect(audit.record).toHaveBeenCalledOnce();
  });
});

const doctor = { userId: 5, hospitalId: 4, role: 'DOCTOR' as never };
const v2Content = {
  schemaVersion: 2,
  handoffGenerator: { kind: 'deterministic', rulesVersion: CLINIC_HANDOFF_RULES_VERSION, promptVersion: null, model: null },
  segments: [
    { id: 'ask:0', kind: 'ask', text: 'Any shortness of breath right now?', voice: 'generated', section: 'ask_in_room', ruleId: 'ask.unscreened.breathing' },
    { id: 'ask:0:why', kind: 'ask_why', text: 'Not asked during the assessment.', voice: 'generated', section: 'ask_in_room', ruleId: 'ask.unscreened.breathing' },
  ],
};

/** A service whose visit is in Care and whose state() is stubbed, for the write paths. */
function writeService(snapshotContent: unknown, existingQuestion: unknown = null) {
  const tx = {
    $executeRaw: vi.fn(),
    encounter: { findUniqueOrThrow: vi.fn(async () => ({ status: 'CARE' })) },
    careAssessmentSnapshot: { findFirst: vi.fn(async () => ({ id: 31, content: snapshotContent })) },
    careOpenQuestion: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => existingQuestion),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 61, ...data })),
      update: vi.fn(async () => ({})),
    },
  };
  const prisma = {
    encounter: { findFirst: vi.fn(async () => ({ id: 7, status: 'CARE' })) },
    careAssessmentSnapshot: tx.careAssessmentSnapshot,
    careAiFeedback: { upsert: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({ count: 1 })) },
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
  };
  const built = careService(prisma);
  vi.spyOn(built.service, 'state').mockResolvedValue({ ok: true } as never);
  return { ...built, prisma, tx };
}

describe('Care feedback', () => {
  it('stores one verdict per clinician and item, with the rule and generator that wrote it', async () => {
    const { service, prisma } = writeService(v2Content);
    await service.setFeedback(doctor, 7, { snapshotId: 31, kind: 'NOT_RIGHT', segmentId: 'ask:0', note: 'Already asked at the desk' });
    expect(prisma.careAiFeedback.upsert).toHaveBeenCalledWith({
      where: { snapshotId_actorUserId_targetKey: { snapshotId: 31, actorUserId: 5, targetKey: 'ask:0' } },
      create: expect.objectContaining({ encounterId: 7, hospitalId: 4, snapshotId: 31, targetKey: 'ask:0', actorUserId: 5, kind: 'NOT_RIGHT', sectionKey: 'ask_in_room', ruleId: 'ask.unscreened.breathing', generatorVersion: CLINIC_HANDOFF_RULES_VERSION, note: 'Already asked at the desk' }),
      update: expect.objectContaining({ kind: 'NOT_RIGHT', note: 'Already asked at the desk' }),
    });
  });

  it('refuses older snapshots and anything that is not generated text', async () => {
    await expect(writeService(v1Content).service.setFeedback(doctor, 7, { snapshotId: 31, kind: 'USEFUL', segmentId: 'summary:briefing' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(writeService(v2Content).service.setFeedback(doctor, 7, { snapshotId: 31, kind: 'USEFUL', segmentId: 'answer:q1' })).rejects.toThrow('That item isn’t in this assessment');
  });

  it('clears only the clinician’s own feedback', async () => {
    const { service, prisma } = writeService(v2Content);
    await service.clearFeedback(doctor, 7, { snapshotId: 31, targetKey: 'ask:0' });
    expect(prisma.careAiFeedback.deleteMany).toHaveBeenCalledWith({ where: { encounterId: 7, hospitalId: 4, snapshotId: 31, actorUserId: 5, targetKey: 'ask:0' } });
  });
});

describe('Ask in the room', () => {
  it('records a ticked item as an asked question, with the text from the snapshot', async () => {
    const { service, tx } = writeService(v2Content);
    await service.addOpenQuestion(doctor, 7, { commandKey: '0b8c1d1e-6a8b-4c43-9a43-6d3f8d1d2a11', text: 'edited on the client', snapshotId: 31, sourceSegmentId: 'ask:0', addressed: true });
    expect(tx.careOpenQuestion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ text: 'Any shortness of breath right now?', snapshotId: 31, sourceSegmentId: 'ask:0', addressedAt: expect.any(Date) }) });
  });

  it('marks an item already ticked elsewhere as asked instead of adding it twice', async () => {
    const { service, tx } = writeService(v2Content, { id: 61, addressedAt: null });
    await service.addOpenQuestion(doctor, 7, { commandKey: '0b8c1d1e-6a8b-4c43-9a43-6d3f8d1d2a12', text: 'x', snapshotId: 31, sourceSegmentId: 'ask:0', addressed: true });
    expect(tx.careOpenQuestion.create).not.toHaveBeenCalled();
    expect(tx.careOpenQuestion.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 61 }, data: expect.objectContaining({ addressedAt: expect.any(Date) }) }));
  });

  it('only accepts items from the Ask in the room list', async () => {
    const { service } = writeService(v2Content);
    await expect(service.addOpenQuestion(doctor, 7, { commandKey: '0b8c1d1e-6a8b-4c43-9a43-6d3f8d1d2a13', text: 'x', snapshotId: 31, sourceSegmentId: 'ask:4' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.addOpenQuestion(doctor, 7, { commandKey: '0b8c1d1e-6a8b-4c43-9a43-6d3f8d1d2a14', text: 'x', sourceSegmentId: 'ask:0' })).rejects.toThrow('Say which assessment version the item is from');
  });

  it('stores what the patient said, and clears it when emptied', async () => {
    const { service, tx } = writeService(v2Content, { id: 61, version: 2, text: 'Any shortness of breath right now?', addressedAt: new Date(), answerText: null });
    await service.updateOpenQuestion(doctor, 7, 61, { expectedVersion: 2, answerText: '  Only on stairs ' });
    expect(tx.careOpenQuestion.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ answerText: 'Only on stairs' }) }));
    await service.updateOpenQuestion(doctor, 7, 61, { expectedVersion: 2, answerText: '' });
    expect(tx.careOpenQuestion.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ answerText: null }) }));
  });
});
