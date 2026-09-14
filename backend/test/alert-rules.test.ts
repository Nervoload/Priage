import { AlertSeverity, EncounterStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  type AlertRuleEncounter,
  evaluateObjectiveAlertRules,
  getAlertRuleManifest,
} from '../src/modules/alerts/alert-rules';

const now = new Date('2026-08-24T12:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

function encounter(overrides: Partial<AlertRuleEncounter>): AlertRuleEncounter {
  return {
    id: 1,
    hospitalId: 1,
    status: EncounterStatus.ADMITTED,
    currentCtasLevel: null,
    arrivedAt: now,
    triagedAt: null,
    waitingAt: null,
    ...overrides,
  };
}

function severityFor(input: AlertRuleEncounter, ruleKey: string) {
  return evaluateObjectiveAlertRules(input, now).find((rule) => rule.ruleKey === ruleKey)?.severity;
}

describe('objective alert rules', () => {
  it('creates an immediate critical CTAS-1 alert', () => {
    expect(severityFor(encounter({ currentCtasLevel: 1 }), 'CTAS1_NOT_IN_TRIAGE')).toBe(AlertSeverity.CRITICAL);
  });

  it('changes CTAS-2 from absent to high to critical at exact boundaries', () => {
    expect(severityFor(encounter({ currentCtasLevel: 2, arrivedAt: minutesAgo(29.999) }), 'CTAS2_LONG_WAIT')).toBeUndefined();
    expect(severityFor(encounter({ currentCtasLevel: 2, arrivedAt: minutesAgo(30) }), 'CTAS2_LONG_WAIT')).toBe(AlertSeverity.HIGH);
    expect(severityFor(encounter({ currentCtasLevel: 2, arrivedAt: minutesAgo(60) }), 'CTAS2_LONG_WAIT')).toBe(AlertSeverity.CRITICAL);
  });

  it('does not infer missing timestamps from updatedAt', () => {
    expect(evaluateObjectiveAlertRules(encounter({ arrivedAt: null }), now)).toEqual([]);
    expect(evaluateObjectiveAlertRules(encounter({ status: EncounterStatus.TRIAGE, triagedAt: null }), now)).toEqual([]);
    expect(evaluateObjectiveAlertRules(encounter({ status: EncounterStatus.WAITING, waitingAt: null }), now)).toEqual([]);
  });

  it('uses the latest triage timestamp for reassessment and waitingAt for long waits', () => {
    const matches = evaluateObjectiveAlertRules(encounter({
      status: EncounterStatus.WAITING,
      triagedAt: minutesAgo(30),
      waitingAt: minutesAgo(600),
    }), now);
    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleKey: 'TRIAGE_REASSESSMENT_OVERDUE', severity: AlertSeverity.MEDIUM }),
      expect.objectContaining({ ruleKey: 'WAITING_LONG', severity: AlertSeverity.CRITICAL }),
    ]));
  });

  it('does not include keyword or profile-seen rules', () => {
    expect(evaluateObjectiveAlertRules(encounter({ status: EncounterStatus.EXPECTED }), now)).toEqual([]);
  });

  it('covers exact admitted, triage, reassessment, and long-wait warning edges', () => {
    expect(severityFor(encounter({ arrivedAt: minutesAgo(59.999) }), 'ADMITTED_LONG_WAIT')).toBeUndefined();
    expect(severityFor(encounter({ arrivedAt: minutesAgo(60) }), 'ADMITTED_LONG_WAIT')).toBe(AlertSeverity.MEDIUM);
    expect(severityFor(encounter({ status: EncounterStatus.TRIAGE, triagedAt: minutesAgo(19.999) }), 'TRIAGE_STALE')).toBeUndefined();
    expect(severityFor(encounter({ status: EncounterStatus.TRIAGE, triagedAt: minutesAgo(20) }), 'TRIAGE_STALE')).toBe(AlertSeverity.MEDIUM);
    expect(severityFor(encounter({ status: EncounterStatus.WAITING, triagedAt: minutesAgo(29.999), waitingAt: now }), 'TRIAGE_REASSESSMENT_OVERDUE')).toBeUndefined();
    expect(severityFor(encounter({ status: EncounterStatus.WAITING, triagedAt: minutesAgo(30), waitingAt: now }), 'TRIAGE_REASSESSMENT_OVERDUE')).toBe(AlertSeverity.MEDIUM);
    expect(severityFor(encounter({ status: EncounterStatus.WAITING, triagedAt: now, waitingAt: minutesAgo(479.999) }), 'WAITING_LONG')).toBeUndefined();
    expect(severityFor(encounter({ status: EncounterStatus.WAITING, triagedAt: now, waitingAt: minutesAgo(480) }), 'WAITING_LONG')).toBe(AlertSeverity.HIGH);
    expect(severityFor(encounter({ status: EncounterStatus.WAITING, triagedAt: now, waitingAt: minutesAgo(599.999) }), 'WAITING_LONG')).toBe(AlertSeverity.HIGH);
    expect(severityFor(encounter({ status: EncounterStatus.WAITING, triagedAt: now, waitingAt: minutesAgo(600) }), 'WAITING_LONG')).toBe(AlertSeverity.CRITICAL);
  });

  it('does not create irrelevant rules for mismatched status, CTAS, or missing clocks', () => {
    expect(evaluateObjectiveAlertRules(encounter({ currentCtasLevel: 1, status: EncounterStatus.TRIAGE }), now))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ ruleKey: 'CTAS1_NOT_IN_TRIAGE' })]));
    expect(evaluateObjectiveAlertRules(encounter({ currentCtasLevel: 2, status: EncounterStatus.WAITING }), now))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ ruleKey: 'CTAS2_LONG_WAIT' })]));
    expect(evaluateObjectiveAlertRules(encounter({ currentCtasLevel: 1, arrivedAt: minutesAgo(60) }), now))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ ruleKey: 'ADMITTED_LONG_WAIT' })]));
    expect(evaluateObjectiveAlertRules(encounter({ currentCtasLevel: 2, arrivedAt: minutesAgo(60) }), now))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ ruleKey: 'ADMITTED_LONG_WAIT' })]));
    expect(evaluateObjectiveAlertRules(encounter({ status: EncounterStatus.WAITING, triagedAt: null, waitingAt: null }), now))
      .toEqual([]);
  });

  it('clamps future lifecycle timestamps to zero elapsed minutes', () => {
    expect(evaluateObjectiveAlertRules(encounter({ arrivedAt: new Date(now.getTime() + 60_000) }), now)).toEqual([]);
  });

  it('publishes only the six approved objective rules in the versioned manifest', () => {
    expect(getAlertRuleManifest()).toEqual({
      version: 'objective-v1',
      rules: [
        { ruleKey: 'CTAS1_NOT_IN_TRIAGE', thresholds: {} },
        { ruleKey: 'CTAS2_LONG_WAIT', thresholds: { highMinutes: 30, criticalMinutes: 60 } },
        { ruleKey: 'ADMITTED_LONG_WAIT', thresholds: { mediumMinutes: 60 } },
        { ruleKey: 'TRIAGE_STALE', thresholds: { mediumMinutes: 20 } },
        { ruleKey: 'TRIAGE_REASSESSMENT_OVERDUE', thresholds: { mediumMinutes: 30 } },
        { ruleKey: 'WAITING_LONG', thresholds: { highMinutes: 480, criticalMinutes: 600 } },
      ],
    });
  });
});
