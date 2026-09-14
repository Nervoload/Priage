// HospitalApp/src/shared/api/alertDerivation.ts
// Client-side alert derivation — generates local alerts by analyzing encounter data.
//
// These alerts are derived on the frontend from encounter state using the
// authenticated server rule manifest. They are optimistic render-only; the
// server owns persistence and lifecycle decisions.
//
// Each derived alert carries a deterministic `id` so React can key them stably.

import type { Encounter, AlertSeverity } from '../types/domain';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DerivedAlert {
  /** Deterministic id: `derived-<encounterId>-<rule>` */
  id: string;
  encounterId: number;
  type: string;
  ruleKey: string;
  severity: AlertSeverity;
  message: string;
  patientName: string;
  timestamp: string;
  acknowledged: boolean;
}

// ─── Configuration ──────────────────────────────────────────────────────────

type AlertThresholds = {
  admittedWaitWarning: number;
  admittedWaitCritical: number;
  admittedLongWarning: number;
  triageStaleWarning: number;
  waitingLongWarning: number;
  waitingLongCritical: number;
  reassessmentWarning: number;
};

export interface AlertRuleManifest {
  version: string;
  rules: Array<{ ruleKey: string; thresholds: Record<string, number> }>;
}

function thresholdsFromManifest(manifest?: AlertRuleManifest | null): AlertThresholds | null {
  if (!manifest) return null;
  const byKey = new Map(manifest.rules.map((rule) => [rule.ruleKey, rule.thresholds]));
  const ctas2 = byKey.get('CTAS2_LONG_WAIT');
  const admitted = byKey.get('ADMITTED_LONG_WAIT');
  const triage = byKey.get('TRIAGE_STALE');
  const waiting = byKey.get('WAITING_LONG');
  const reassessment = byKey.get('TRIAGE_REASSESSMENT_OVERDUE');
  if (
    ctas2?.highMinutes === undefined
    || ctas2.criticalMinutes === undefined
    || admitted?.mediumMinutes === undefined
    || triage?.mediumMinutes === undefined
    || waiting?.highMinutes === undefined
    || waiting.criticalMinutes === undefined
    || reassessment?.mediumMinutes === undefined
  ) return null;
  return {
    admittedWaitWarning: ctas2.highMinutes,
    admittedWaitCritical: ctas2.criticalMinutes,
    admittedLongWarning: admitted.mediumMinutes,
    triageStaleWarning: triage.mediumMinutes,
    waitingLongWarning: waiting.highMinutes,
    waitingLongCritical: waiting.criticalMinutes,
    reassessmentWarning: reassessment.mediumMinutes,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function minutesSince(isoDate: string | null | undefined): number {
  if (!isoDate) return 0;
  return (Date.now() - new Date(isoDate).getTime()) / 60_000;
}

function patientDisplayName(enc: Encounter): string {
  const p = enc.patient;
  if (p.firstName || p.lastName) {
    return [p.firstName, p.lastName].filter(Boolean).join(' ');
  }
  return `Patient #${p.id}`;
}

// ─── Derivation rules ──────────────────────────────────────────────────────

type DerivationRule = (enc: Encounter, thresholds: AlertThresholds) => DerivedAlert | null;

/**
 * CRITICAL-priority patients (CTAS 1) that are still in ADMITTED or WAITING —
 * they should be in triage immediately.
 */
const criticalTriagePending: DerivationRule = (enc) => {
  if (enc.currentCtasLevel !== 1) return null;
  if (enc.status !== 'ADMITTED' && enc.status !== 'WAITING') return null;
  return {
    id: `derived-${enc.id}-ctas1-waiting`,
    encounterId: enc.id,
    type: 'CTAS1_NOT_IN_TRIAGE',
    ruleKey: 'CTAS1_NOT_IN_TRIAGE',
    severity: 'CRITICAL',
    message: `${patientDisplayName(enc)} is CTAS-1 but still ${enc.status.toLowerCase()}`,
    patientName: patientDisplayName(enc),
    timestamp: enc.updatedAt,
    acknowledged: false,
  };
};

/**
 * High-acuity patients (CTAS 2) waiting too long in ADMITTED.
 */
const highAcuityWaiting: DerivationRule = (enc, thresholds) => {
  if (enc.currentCtasLevel !== 2) return null;
  if (enc.status !== 'ADMITTED') return null;
  const mins = minutesSince(enc.arrivedAt);
  if (mins < thresholds.admittedWaitWarning) return null;
  return {
    id: `derived-${enc.id}-ctas2-admitted-long`,
    encounterId: enc.id,
    type: 'CTAS2_LONG_WAIT',
    ruleKey: 'CTAS2_LONG_WAIT',
    severity: mins >= thresholds.admittedWaitCritical ? 'CRITICAL' : 'HIGH',
    message: `${patientDisplayName(enc)} (CTAS-2) admitted ${Math.round(mins)} min ago — not yet triaged`,
    patientName: patientDisplayName(enc),
    timestamp: enc.updatedAt,
    acknowledged: false,
  };
};

/**
 * Any patient in ADMITTED status for too long without being moved forward.
 */
const admittedTooLong: DerivationRule = (enc, thresholds) => {
  if (enc.status !== 'ADMITTED') return null;
  // Skip if a more specific acuity rule already fired
  if (enc.currentCtasLevel === 1 || enc.currentCtasLevel === 2) return null;
  const mins = minutesSince(enc.arrivedAt);
  if (mins < thresholds.admittedLongWarning) return null;
  return {
    id: `derived-${enc.id}-admitted-long`,
    encounterId: enc.id,
    type: 'ADMITTED_LONG_WAIT',
    ruleKey: 'ADMITTED_LONG_WAIT',
    severity: 'MEDIUM',
    message: `${patientDisplayName(enc)} has been admitted for ${Math.round(mins)} min without triage`,
    patientName: patientDisplayName(enc),
    timestamp: enc.updatedAt,
    acknowledged: false,
  };
};

/**
 * Patient in TRIAGE status for a long time without a completed assessment.
 */
const triageStale: DerivationRule = (enc, thresholds) => {
  if (enc.status !== 'TRIAGE') return null;
  if (!enc.triagedAt) return null;
  const mins = minutesSince(enc.triagedAt);
  if (mins < thresholds.triageStaleWarning) return null;
  return {
    id: `derived-${enc.id}-triage-stale`,
    encounterId: enc.id,
    type: 'TRIAGE_STALE',
    ruleKey: 'TRIAGE_STALE',
    severity: 'MEDIUM',
    message: `${patientDisplayName(enc)} has been in triage for ${Math.round(mins)} min`,
    patientName: patientDisplayName(enc),
    timestamp: enc.updatedAt,
    acknowledged: false,
  };
};

/**
 * Patient in WAITING status for an extended period.
 */
const waitingTooLong: DerivationRule = (enc, thresholds) => {
  if (enc.status !== 'WAITING') return null;
  if (!enc.waitingAt) return null;
  const mins = minutesSince(enc.waitingAt);
  if (mins < thresholds.waitingLongWarning) return null;
  const severity: AlertSeverity =
    mins >= thresholds.waitingLongCritical ? 'CRITICAL' : 'HIGH';
  return {
    id: `derived-${enc.id}-waiting-long`,
    encounterId: enc.id,
    type: 'WAITING_LONG',
    ruleKey: 'WAITING_LONG',
    severity,
    message: `${patientDisplayName(enc)} has been waiting for ${Math.round(mins)} min`,
    patientName: patientDisplayName(enc),
    timestamp: enc.updatedAt,
    acknowledged: false,
  };
};

const triageReassessment: DerivationRule = (enc, thresholds) => {
  if (enc.status !== 'WAITING' || !enc.triagedAt) return null;
  const mins = minutesSince(enc.triagedAt);
  if (mins < thresholds.reassessmentWarning) return null;
  return {
    id: `derived-${enc.id}-triage-reassessment-overdue`,
    encounterId: enc.id,
    type: 'TRIAGE_REASSESSMENT_OVERDUE',
    ruleKey: 'TRIAGE_REASSESSMENT_OVERDUE',
    severity: 'MEDIUM',
    message: `${patientDisplayName(enc)} is due for triage reassessment`,
    patientName: patientDisplayName(enc),
    timestamp: enc.triagedAt,
    acknowledged: false,
  };
};

// All rules in priority order
const RULES: DerivationRule[] = [
  criticalTriagePending,
  highAcuityWaiting,
  admittedTooLong,
  triageStale,
  triageReassessment,
  waitingTooLong,
];

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Derive alerts from a list of encounters.
 * Returns alerts sorted by severity (CRITICAL first).
 */
export function deriveAlertsFromEncounters(
  encounters: Encounter[],
  manifest?: AlertRuleManifest | null,
): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  const thresholds = thresholdsFromManifest(manifest);
  if (!thresholds) return alerts;

  for (const enc of encounters) {
    for (const rule of RULES) {
      const alert = rule(enc, thresholds);
      if (alert) {
        alerts.push(alert);
      }
    }
  }

  // Sort: CRITICAL > HIGH > MEDIUM > LOW
  const severityOrder: Record<AlertSeverity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/** Severity → color mapping for UI rendering */
export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
};

/** Severity → background color (20% opacity feel) */
export const SEVERITY_BG_COLORS: Record<AlertSeverity, string> = {
  CRITICAL: '#fef2f2',
  HIGH: '#fff7ed',
  MEDIUM: '#fefce8',
  LOW: '#eff6ff',
};
