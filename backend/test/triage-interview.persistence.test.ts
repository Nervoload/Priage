import { describe, expect, it, vi } from 'vitest';

import { TriageInterviewService } from '../src/modules/intake/interview/triage-interview.service';
import { SAFETY_GATE_PUBLIC_ID } from '../src/modules/intake/interview/triage-interview.types';

const logging = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

function buildService(overrides: { summaryProjectionFindFirst?: () => Promise<unknown> } = {}) {
  const prisma = {
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work({ $executeRaw: vi.fn() })),
    contextItem: { findFirst: vi.fn(async () => null) },
    summaryProjection: { findFirst: vi.fn(overrides.summaryProjectionFindFirst ?? (async () => null)) },
  };
  const intakeSessions = { appendContextItemsByIntakeSessionId: vi.fn(async () => []) };
  const service = new TriageInterviewService(prisma as any, intakeSessions as any, logging as any, {} as any);
  return { service, intakeSessions };
}

describe('triage interview turn persistence', () => {
  it('stores the answer and the state it produced in one append', async () => {
    const { service, intakeSessions } = buildService();

    const state = await service.advanceByIntakeSession(7, 3, {
      questionPublicId: SAFETY_GATE_PUBLIC_ID,
      valueBoolean: true,
    } as any, undefined, 'corr-1');

    expect(state.status).toBe('emergency_ack_required');
    expect(intakeSessions.appendContextItemsByIntakeSessionId).toHaveBeenCalledTimes(1);
    const [intakeSessionId, items, correlationId] = intakeSessions.appendContextItemsByIntakeSessionId.mock.calls[0] as any[];
    expect(intakeSessionId).toBe(7);
    expect(correlationId).toBe('corr-1');
    expect(items.map((item: { itemType: string }) => item.itemType)).toEqual(['ai_interview_answer', 'ai_interview_state']);
    expect(items[0].payload).toMatchObject({ questionPublicId: SAFETY_GATE_PUBLIC_ID, answerText: 'Yes' });
    // Care derives emergency events from the stored state; the patient never sees the staff-facing fields.
    expect(items[1].payload.emergencyAlert).toMatchObject({ triggerQuestionId: SAFETY_GATE_PUBLIC_ID, reason: expect.any(String) });
    expect(state.emergencyAlert).toEqual({ title: expect.any(String), body: expect.any(String), recommendation: expect.any(String) });
  });

  it('stores nothing when the next state cannot be computed', async () => {
    const { service, intakeSessions } = buildService({
      summaryProjectionFindFirst: async () => {
        throw new Error('database unavailable');
      },
    });

    await expect(service.advanceByIntakeSession(7, 3, {
      questionPublicId: SAFETY_GATE_PUBLIC_ID,
      valueBoolean: false,
    } as any)).rejects.toThrow('database unavailable');

    expect(intakeSessions.appendContextItemsByIntakeSessionId).not.toHaveBeenCalled();
  });
});
