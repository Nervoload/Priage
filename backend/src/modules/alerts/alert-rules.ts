import { AlertSeverity, EncounterStatus } from '@prisma/client';

export const ALERT_RULE_VERSION = 'objective-v1';

export const ALERT_RULE_THRESHOLDS = Object.freeze({
  ctas2HighMinutes: 30,
  ctas2CriticalMinutes: 60,
  admittedLongMinutes: 60,
  triageStaleMinutes: 20,
  reassessmentMinutes: 30,
  waitingHighMinutes: 8 * 60,
  waitingCriticalMinutes: 10 * 60,
});

export type AlertRuleEncounter = {
  id: number;
  hospitalId: number;
  status: EncounterStatus;
  currentCtasLevel: number | null;
  arrivedAt: Date | null;
  triagedAt: Date | null;
  waitingAt: Date | null;
};

export type AlertRuleMatch = {
  ruleKey: string;
  ruleVersion: string;
  type: string;
  severity: AlertSeverity;
  metadata: Record<string, string | number>;
};

function elapsedMinutes(since: Date | null, now: Date): number | null {
  if (!since) return null;
  return Math.max(0, (now.getTime() - since.getTime()) / 60_000);
}

function match(
  ruleKey: string,
  severity: AlertSeverity,
  metadata: Record<string, string | number> = {},
): AlertRuleMatch {
  return { ruleKey, ruleVersion: ALERT_RULE_VERSION, type: ruleKey, severity, metadata };
}

export function evaluateObjectiveAlertRules(
  encounter: AlertRuleEncounter,
  now = new Date(),
): AlertRuleMatch[] {
  const matches: AlertRuleMatch[] = [];
  const arrivedMinutes = elapsedMinutes(encounter.arrivedAt, now);
  const triagedMinutes = elapsedMinutes(encounter.triagedAt, now);
  const waitingMinutes = elapsedMinutes(encounter.waitingAt, now);

  if (
    encounter.currentCtasLevel === 1
    && (encounter.status === EncounterStatus.ADMITTED || encounter.status === EncounterStatus.WAITING)
  ) {
    matches.push(match('CTAS1_NOT_IN_TRIAGE', AlertSeverity.CRITICAL));
  }

  if (
    encounter.currentCtasLevel === 2
    && encounter.status === EncounterStatus.ADMITTED
    && arrivedMinutes !== null
    && arrivedMinutes >= ALERT_RULE_THRESHOLDS.ctas2HighMinutes
  ) {
    matches.push(match(
      'CTAS2_LONG_WAIT',
      arrivedMinutes >= ALERT_RULE_THRESHOLDS.ctas2CriticalMinutes
        ? AlertSeverity.CRITICAL
        : AlertSeverity.HIGH,
      { observedMinutes: Math.floor(arrivedMinutes), thresholdMinutes: ALERT_RULE_THRESHOLDS.ctas2HighMinutes },
    ));
  }

  if (
    encounter.status === EncounterStatus.ADMITTED
    && encounter.currentCtasLevel !== 1
    && encounter.currentCtasLevel !== 2
    && arrivedMinutes !== null
    && arrivedMinutes >= ALERT_RULE_THRESHOLDS.admittedLongMinutes
  ) {
    matches.push(match('ADMITTED_LONG_WAIT', AlertSeverity.MEDIUM, {
      observedMinutes: Math.floor(arrivedMinutes),
      thresholdMinutes: ALERT_RULE_THRESHOLDS.admittedLongMinutes,
    }));
  }

  if (
    encounter.status === EncounterStatus.TRIAGE
    && triagedMinutes !== null
    && triagedMinutes >= ALERT_RULE_THRESHOLDS.triageStaleMinutes
  ) {
    matches.push(match('TRIAGE_STALE', AlertSeverity.MEDIUM, {
      observedMinutes: Math.floor(triagedMinutes),
      thresholdMinutes: ALERT_RULE_THRESHOLDS.triageStaleMinutes,
    }));
  }

  if (
    encounter.status === EncounterStatus.WAITING
    && triagedMinutes !== null
    && triagedMinutes >= ALERT_RULE_THRESHOLDS.reassessmentMinutes
  ) {
    matches.push(match('TRIAGE_REASSESSMENT_OVERDUE', AlertSeverity.MEDIUM, {
      observedMinutes: Math.floor(triagedMinutes),
      thresholdMinutes: ALERT_RULE_THRESHOLDS.reassessmentMinutes,
    }));
  }

  if (
    encounter.status === EncounterStatus.WAITING
    && waitingMinutes !== null
    && waitingMinutes >= ALERT_RULE_THRESHOLDS.waitingHighMinutes
  ) {
    matches.push(match(
      'WAITING_LONG',
      waitingMinutes >= ALERT_RULE_THRESHOLDS.waitingCriticalMinutes
        ? AlertSeverity.CRITICAL
        : AlertSeverity.HIGH,
      { observedMinutes: Math.floor(waitingMinutes), thresholdMinutes: ALERT_RULE_THRESHOLDS.waitingHighMinutes },
    ));
  }

  return matches;
}

export function getAlertRuleManifest() {
  return {
    version: ALERT_RULE_VERSION,
    rules: [
      { ruleKey: 'CTAS1_NOT_IN_TRIAGE', thresholds: {} },
      { ruleKey: 'CTAS2_LONG_WAIT', thresholds: { highMinutes: 30, criticalMinutes: 60 } },
      { ruleKey: 'ADMITTED_LONG_WAIT', thresholds: { mediumMinutes: 60 } },
      { ruleKey: 'TRIAGE_STALE', thresholds: { mediumMinutes: 20 } },
      { ruleKey: 'TRIAGE_REASSESSMENT_OVERDUE', thresholds: { mediumMinutes: 30 } },
      { ruleKey: 'WAITING_LONG', thresholds: { highMinutes: 480, criticalMinutes: 600 } },
    ],
  } as const;
}
