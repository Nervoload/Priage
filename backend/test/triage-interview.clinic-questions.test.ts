import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_CLINIC_QUESTIONS, toInterviewQuestions } from '../src/modules/clinic/questionnaire/clinic-questionnaire';
import { TriageInterviewService } from '../src/modules/intake/interview/triage-interview.service';
import { SAFETY_GATE_PUBLIC_ID, type ClinicQuestionnairePin } from '../src/modules/intake/interview/triage-interview.types';

const logging = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

const pin: ClinicQuestionnairePin = {
  versionId: 12,
  version: 3,
  questions: toInterviewQuestions([
    ...DEFAULT_CLINIC_QUESTIONS,
    { key: 'referral', origin: 'custom', prompt: 'How did you hear about the clinic?', helpText: null, inputType: 'single_select', choices: ['Friend', 'Search', 'Other'] },
  ]),
};

/** A service whose stored state is whatever the last call persisted. */
function buildService() {
  let stored: { publicId: string; payload: unknown } | null = null;
  const prisma = {
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work({ $executeRaw: vi.fn() })),
    contextItem: { findFirst: vi.fn(async ({ where }: { where: { itemType: string } }) => (where.itemType === 'ai_interview_state' ? stored : null)) },
    summaryProjection: { findFirst: vi.fn(async () => null) },
  };
  const intakeSessions = {
    appendContextItemsByIntakeSessionId: vi.fn(async (_id: number, items: Array<{ itemType: string; payload: unknown }>) => {
      const state = items.find((item) => item.itemType === 'ai_interview_state');
      if (state) stored = { publicId: `ctx_${Math.random()}`, payload: JSON.parse(JSON.stringify(state.payload)) };
      return [];
    }),
  };
  const service = new TriageInterviewService(prisma as never, intakeSessions as never, logging as never, {} as never);
  return { service, intakeSessions };
}

describe('clinic questions in the interview', () => {
  it('asks the safety question first, then the clinic’s questions in order, without counting them', async () => {
    const { service } = buildService();
    const first = await service.startByIntakeSession(7, 3, undefined, { clinicQuestionnaire: pin });
    expect(first.currentQuestion?.publicId).toBe(SAFETY_GATE_PUBLIC_ID);

    const travel = await service.advanceByIntakeSession(7, 3, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    expect(travel.currentQuestion).toMatchObject({ publicId: 'clinic:travel_14d', inputType: 'boolean', choices: ['Yes', 'No'] });

    const referral = await service.advanceByIntakeSession(7, 3, { questionPublicId: 'clinic:travel_14d', valueBoolean: true });
    expect(referral.currentQuestion?.publicId).toBe('clinic:referral');
    expect(referral.askedCount).toBe(0);
  });

  it('only accepts a listed choice for a clinic question', async () => {
    const { service } = buildService();
    await service.startByIntakeSession(7, 3, undefined, { clinicQuestionnaire: pin });
    await service.advanceByIntakeSession(7, 3, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: false });
    await service.advanceByIntakeSession(7, 3, { questionPublicId: 'clinic:travel_14d', valueBoolean: false });
    await expect(service.advanceByIntakeSession(7, 3, { questionPublicId: 'clinic:referral', valueChoice: 'Billboard' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the version the interview started with', async () => {
    const { service, intakeSessions } = buildService();
    await service.startByIntakeSession(7, 3, undefined, { clinicQuestionnaire: pin });
    // A later call with a newer version doesn't change a running interview.
    await service.startByIntakeSession(7, 3, undefined, { clinicQuestionnaire: { ...pin, versionId: 13, version: 4, questions: [] } });
    const stored = intakeSessions.appendContextItemsByIntakeSessionId.mock.calls.at(-1)?.[1] as Array<{ payload: { clinicQuestionnaire: ClinicQuestionnairePin } }>;
    expect(stored[0].payload.clinicQuestionnaire).toMatchObject({ versionId: 12, version: 3 });
  });

  it('asks the clinic’s questions after an emergency warning the patient continued past', async () => {
    const { service } = buildService();
    await service.startByIntakeSession(7, 3, undefined, { clinicQuestionnaire: pin });
    const warning = await service.advanceByIntakeSession(7, 3, { questionPublicId: SAFETY_GATE_PUBLIC_ID, valueBoolean: true });
    expect(warning.status).toBe('emergency_ack_required');
    const next = await service.advanceByIntakeSession(7, 3, { action: 'acknowledge_emergency' });
    expect(next.currentQuestion?.publicId).toBe('clinic:travel_14d');
  });
});
