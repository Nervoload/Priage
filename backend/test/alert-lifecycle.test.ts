import {
  AlertSeverity,
  AlertSource,
  EncounterStatus,
  EventType,
  Prisma,
} from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SafetyMetricsService } from '../src/common/metrics/safety-metrics.service';
import { AlertRulesService } from '../src/modules/alerts/alert-rules.service';

const now = new Date('2026-08-24T12:00:00Z');

function createHarness(encounters: any[]) {
  const alerts: any[] = [];
  const eventTypes: EventType[] = [];
  let alertId = 1;
  let eventId = 1;
  const alertApi = {
    findUnique: vi.fn(async ({ where }: any) => (
      where.activeRuleDedupeKey
        ? alerts.find((alert) => alert.activeRuleDedupeKey === where.activeRuleDedupeKey) ?? null
        : alerts.find((alert) => alert.id === where.id) ?? null
    )),
    findFirst: vi.fn(async ({ where }: any) => alerts.find((alert) => (
      alert.id === where.id
      && alert.hospitalId === where.hospitalId
      && alert.source === where.source
      && alert.conditionClearedAt === null
    )) ?? null),
    findMany: vi.fn(async ({ where }: any) => alerts.filter((alert) => {
      if (alert.encounterId !== where.encounterId || alert.hospitalId !== where.hospitalId) return false;
      if (where.source && alert.source !== where.source) return false;
      if (where.conditionClearedAt === null && alert.conditionClearedAt !== null) return false;
      if (where.resolvedAt === null && alert.resolvedAt !== null) return false;
      if (where.ruleKey?.notIn?.includes(alert.ruleKey)) return false;
      return true;
    })),
    create: vi.fn(async ({ data }: any) => {
      await Promise.resolve();
      if (alerts.some((alert) => alert.activeRuleDedupeKey === data.activeRuleDedupeKey)) {
        throw new Prisma.PrismaClientKnownRequestError('dedupe', { code: 'P2002', clientVersion: '7.2.0' });
      }
      const created = {
        id: alertId++,
        createdAt: now,
        acknowledgedAt: null,
        acknowledgedByUserId: null,
        resolvedAt: null,
        resolvedByUserId: null,
        resolutionReason: null,
        conditionClearedAt: null,
        ...data,
      };
      alerts.push(created);
      return created;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const alert = alerts.find((candidate) => candidate.id === where.id);
      Object.assign(alert, data);
      return alert;
    }),
  };
  const prisma = {
    encounter: {
      findUnique: vi.fn(async ({ where }: any) => encounters.find((encounter) => (
        encounter.id === where.id_hospitalId.id && encounter.hospitalId === where.id_hospitalId.hospitalId
      )) ?? null),
      findMany: vi.fn(async ({ where, take }: any) => encounters
        .filter((encounter) => encounter.id > where.id.gt)
        .sort((left, right) => left.id - right.id)
        .slice(0, take)
        .map(({ id, hospitalId }) => ({ id, hospitalId }))),
    },
    alert: alertApi,
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback({ alert: alertApi })),
  };
  const events = {
    emitEncounterEventTx: vi.fn(async (_tx: unknown, input: any) => {
      eventTypes.push(input.type);
      return { id: eventId++, createdAt: now, ...input };
    }),
    dispatchEncounterEventAndMarkProcessed: vi.fn(),
  };
  const logging = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() };
  const outbox = { enqueueAlertLifecycleTx: vi.fn() };
  const metrics = new SafetyMetricsService();
  const service = new AlertRulesService(
    prisma as never,
    events as never,
    logging as never,
    outbox as never,
    metrics,
  );
  return { service, alerts, eventTypes, outbox, metrics, prisma, logging };
}

describe('server alert lifecycle', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('clears acknowledgement on escalation, auto-resolves, and permits recurrence', async () => {
    vi.stubEnv('ALERT_RULE_ENGINE_MODE', 'active');
    const encounter = {
      id: 1,
      hospitalId: 7,
      status: EncounterStatus.ADMITTED,
      currentCtasLevel: 2,
      arrivedAt: new Date(now.getTime() - 30 * 60_000),
      triagedAt: null,
      waitingAt: null,
    };
    const harness = createHarness([encounter]);
    await harness.service.evaluateEncounter(1, 7, now);
    expect(harness.alerts[0]).toMatchObject({ severity: AlertSeverity.HIGH, source: AlertSource.RULE_ENGINE });

    harness.alerts[0].acknowledgedAt = new Date();
    harness.alerts[0].acknowledgedByUserId = 99;
    encounter.arrivedAt = new Date(now.getTime() - 60 * 60_000);
    await harness.service.evaluateEncounter(1, 7, now);
    expect(harness.alerts[0]).toMatchObject({
      severity: AlertSeverity.CRITICAL,
      acknowledgedAt: null,
      acknowledgedByUserId: null,
    });
    expect(harness.eventTypes).toContain(EventType.ALERT_ESCALATED);
    expect(harness.outbox.enqueueAlertLifecycleTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'alert.escalated',
    );

    encounter.status = EncounterStatus.COMPLETE;
    await harness.service.evaluateEncounter(1, 7, now);
    expect(harness.alerts[0].resolvedAt).toEqual(now);
    expect(harness.alerts[0].activeRuleDedupeKey).toBeNull();
    expect(harness.outbox.enqueueAlertLifecycleTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'alert.resolved',
    );

    encounter.status = EncounterStatus.ADMITTED;
    await harness.service.evaluateEncounter(1, 7, now);
    expect(harness.alerts).toHaveLength(2);
    expect(harness.alerts[1].id).not.toBe(harness.alerts[0].id);
  });

  it('converges concurrent evaluation on one active hospital/encounter/rule alert', async () => {
    vi.stubEnv('ALERT_RULE_ENGINE_MODE', 'active');
    const harness = createHarness([{
      id: 1,
      hospitalId: 7,
      status: EncounterStatus.ADMITTED,
      currentCtasLevel: 1,
      arrivedAt: now,
      triagedAt: null,
      waitingAt: null,
    }]);
    await Promise.all([
      harness.service.evaluateEncounter(1, 7, now),
      harness.service.evaluateEncounter(1, 7, now),
    ]);
    expect(harness.alerts).toHaveLength(1);
    expect(harness.metrics.snapshot().alertDedupeConflicts).toBe(1);
  });

  it('does not cross tenant boundaries when encounter IDs are guessed', async () => {
    vi.stubEnv('ALERT_RULE_ENGINE_MODE', 'active');
    const harness = createHarness([{
      id: 1,
      hospitalId: 7,
      status: EncounterStatus.ADMITTED,
      currentCtasLevel: 1,
      arrivedAt: now,
      triagedAt: null,
      waitingAt: null,
    }]);
    await expect(harness.service.evaluateEncounter(1, 8, now)).rejects.toThrow(/does not belong/);
    expect(harness.alerts).toEqual([]);
  });

  it('keyset-paginates beyond 500 encounters without starving later IDs', async () => {
    vi.stubEnv('ALERT_RULE_ENGINE_MODE', 'shadow');
    const encounters = Array.from({ length: 501 }, (_, index) => ({
      id: index + 1,
      hospitalId: index % 2 ? 7 : 8,
      status: EncounterStatus.WAITING,
      currentCtasLevel: null,
      arrivedAt: now,
      triagedAt: now,
      waitingAt: now,
    }));
    const harness = createHarness(encounters);
    await expect(harness.service.sweepAll(now, 250)).resolves.toEqual({ evaluated: 501, pages: 3 });
    expect(harness.metrics.snapshot().lastSweep).toMatchObject({ evaluated: 501, pages: 3 });
  });

  it('emits data-quality metrics for each missing status clock without updatedAt fallback', async () => {
    vi.stubEnv('ALERT_RULE_ENGINE_MODE', 'shadow');
    const harness = createHarness([
      { id: 1, hospitalId: 7, status: EncounterStatus.ADMITTED, currentCtasLevel: null, arrivedAt: null, triagedAt: null, waitingAt: null },
      { id: 2, hospitalId: 7, status: EncounterStatus.TRIAGE, currentCtasLevel: null, arrivedAt: now, triagedAt: null, waitingAt: null },
      { id: 3, hospitalId: 7, status: EncounterStatus.WAITING, currentCtasLevel: null, arrivedAt: now, triagedAt: now, waitingAt: null },
      { id: 4, hospitalId: 7, status: EncounterStatus.WAITING, currentCtasLevel: null, arrivedAt: now, triagedAt: null, waitingAt: now },
    ]);
    await harness.service.evaluateEncounter(1, 7, now);
    await harness.service.evaluateEncounter(2, 7, now);
    await harness.service.evaluateEncounter(3, 7, now);
    await harness.service.evaluateEncounter(4, 7, now);
    expect(harness.metrics.snapshot().missingLifecycleTimestamps).toBe(4);
    expect(harness.logging.warn).toHaveBeenCalledTimes(4);
  });

  it('rejects an invalid engine mode and defaults to shadow when omitted', async () => {
    const encounter = {
      id: 1,
      hospitalId: 7,
      status: EncounterStatus.ADMITTED,
      currentCtasLevel: 1,
      arrivedAt: now,
      triagedAt: null,
      waitingAt: null,
    };
    const harness = createHarness([encounter]);
    await expect(harness.service.evaluateEncounter(1, 7, now)).resolves.toEqual([]);
    vi.stubEnv('ALERT_RULE_ENGINE_MODE', 'invalid');
    await expect(harness.service.evaluateEncounter(1, 7, now)).rejects.toThrow(/shadow or active/);
  });

  it('handles an empty sweep and clamps unsafe batch sizes', async () => {
    vi.stubEnv('ALERT_RULE_ENGINE_MODE', 'shadow');
    const empty = createHarness([]);
    await expect(empty.service.sweepAll(now, 0)).resolves.toEqual({ evaluated: 0, pages: 0 });
    const one = createHarness([{
      id: 1,
      hospitalId: 7,
      status: EncounterStatus.EXPECTED,
      currentCtasLevel: null,
      arrivedAt: null,
      triagedAt: null,
      waitingAt: null,
    }]);
    await expect(one.service.sweepAll(now, 2000)).resolves.toEqual({ evaluated: 1, pages: 1 });
  });
});
