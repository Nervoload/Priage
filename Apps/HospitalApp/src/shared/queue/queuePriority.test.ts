import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Encounter } from '../types/domain';
import {
  computePriorityScore,
  formatWaitStatus,
  getCtasTarget,
  getQueuePositions,
  sortByQueuePriority,
} from './queuePriority';

function encounter(overrides: Partial<Encounter>): Encounter {
  return {
    id: 1,
    createdAt: '2026-08-24T10:00:00.000Z',
    updatedAt: '2026-08-24T10:00:00.000Z',
    status: 'WAITING',
    hospitalId: 1,
    patientId: 1,
    currentCtasLevel: 3,
    currentPriorityScore: null,
    expectedAt: null,
    arrivedAt: null,
    triagedAt: null,
    waitingAt: '2026-08-24T10:00:00.000Z',
    seenAt: null,
    departedAt: null,
    cancelledAt: null,
    chiefComplaint: null,
    details: null,
    patient: { id: 1, firstName: 'Test', lastName: 'Patient' },
    alerts: [],
    messages: [],
    triageAssessments: [],
    ...overrides,
  } as Encounter;
}

describe('queue priority', () => {
  afterEach(() => vi.useRealTimers());

  it('starts escalation exactly at the CTAS target boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:30:00.000Z'));
    const result = computePriorityScore(encounter({ currentCtasLevel: 3 }));
    expect(result.waitRatio).toBe(1);
    expect(result.waitStatus).toBe('overdue');
    expect(result.score).toBe(60);
  });

  it('uses FIFO when scores are within the tie tolerance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:10:00.000Z'));
    const later = encounter({ id: 2, waitingAt: '2026-08-24T10:01:00.000Z' });
    const earlier = encounter({ id: 1, waitingAt: '2026-08-24T10:00:00.000Z' });
    expect(sortByQueuePriority([later, earlier]).map((entry) => entry.encounter.id)).toEqual([1, 2]);
  });

  it('always ranks CTAS-1 ahead of lower acuity', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:10:00.000Z'));
    const low = encounter({ id: 2, currentCtasLevel: 5, waitingAt: '2026-08-23T10:00:00.000Z' });
    const critical = encounter({ id: 1, currentCtasLevel: 1 });
    expect(sortByQueuePriority([low, critical])[0]?.encounter.id).toBe(1);
    expect(sortByQueuePriority([critical, low])[0]?.encounter.id).toBe(1);
  });

  it('pins CTAS-1 at immediate priority and distinguishes zero from positive wait', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00.000Z'));
    expect(computePriorityScore(encounter({ currentCtasLevel: 1, waitingAt: '2026-08-24T10:00:00.000Z' })))
      .toMatchObject({ score: 100, targetMinutes: 0, waitStatus: 'on-time', waitRatio: Infinity });
    expect(computePriorityScore(encounter({ currentCtasLevel: 1, waitingAt: '2026-08-24T09:59:00.000Z' })))
      .toMatchObject({ score: 100.5, waitStatus: 'overdue' });
  });

  it('uses each lifecycle clock in order and clamps future clocks to zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:30:00.000Z'));
    expect(computePriorityScore(encounter({ waitingAt: '2026-08-24T10:40:00.000Z' })).waitMinutes).toBe(0);
    expect(computePriorityScore(encounter({ waitingAt: null, triagedAt: '2026-08-24T10:20:00.000Z' })).waitMinutes).toBe(10);
    expect(computePriorityScore(encounter({ waitingAt: null, triagedAt: null, arrivedAt: '2026-08-24T10:15:00.000Z' })).waitMinutes).toBe(15);
    expect(computePriorityScore(encounter({ waitingAt: null, triagedAt: null, arrivedAt: null })).waitMinutes).toBe(30);
  });

  it('classifies on-time, approaching, and overdue waits and escalates only after target', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00.000Z'));
    const onTime = computePriorityScore(encounter({ currentCtasLevel: 4, waitingAt: '2026-08-24T09:30:01.000Z' }));
    const approaching = computePriorityScore(encounter({ currentCtasLevel: 4, waitingAt: '2026-08-24T09:15:00.000Z' }));
    const overdue = computePriorityScore(encounter({ currentCtasLevel: 4, waitingAt: '2026-08-24T08:00:00.000Z' }));
    expect(onTime).toMatchObject({ waitStatus: 'on-time', score: 40 });
    expect(approaching).toMatchObject({ waitStatus: 'approaching', score: 40 });
    expect(overdue).toMatchObject({ waitStatus: 'overdue', score: 55 });
  });

  it('sorts different scores before FIFO and assigns one-based positions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00.000Z'));
    const lessUrgent = encounter({ id: 4, currentCtasLevel: 4, waitingAt: '2026-08-24T09:59:00.000Z' });
    const emergent = encounter({ id: 2, currentCtasLevel: 2, waitingAt: '2026-08-24T09:59:00.000Z' });
    const entries = sortByQueuePriority([lessUrgent, emergent]);
    expect(entries.map((entry) => [entry.encounter.id, entry.position])).toEqual([[2, 1], [4, 2]]);
  });

  it('builds queue maps and formats every wait status', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T10:00:00.000Z'));
    expect(getQueuePositions([]).size).toBe(0);
    expect(getQueuePositions([encounter({ id: 7 })]).get(7)?.position).toBe(1);
    expect(formatWaitStatus('on-time')).toEqual({ label: 'On Time', color: '#22c55e' });
    expect(formatWaitStatus('approaching')).toEqual({ label: 'Approaching', color: '#f59e0b' });
    expect(formatWaitStatus('overdue')).toEqual({ label: 'Overdue', color: '#ef4444' });
  });

  it('returns targets for assigned, unassigned, and invalid CTAS values', () => {
    expect(getCtasTarget(2)).toEqual({ label: 'Emergent', targetMin: 15 });
    expect(getCtasTarget(null)).toEqual({ label: 'Unassigned', targetMin: 120 });
    expect(getCtasTarget(99)).toEqual({ label: 'Unassigned', targetMin: 120 });
    expect(computePriorityScore(encounter({ currentCtasLevel: null }))).toMatchObject({ targetMinutes: 120 });
    expect(computePriorityScore(encounter({ currentCtasLevel: 99 }))).toMatchObject({ targetMinutes: 120 });
  });
});
