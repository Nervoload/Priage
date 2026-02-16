// HospitalApp/src/shared/api/alertDerivation.ts
// Client-side alert derivation — generates local alerts by analyzing encounter data.
//
// These alerts are derived on the frontend from encounter state (status, wait time,
// triage level, timestamps). They complement the server-side alerts stored in the
// backend Alert table by giving staff instant visual feedback without requiring
// a round-trip.
//
// Each derived alert carries a deterministic `id` so React can key them stably.

import type { Encounter, AlertSeverity } from '../types/domain';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DerivedAlert {
  /** Deterministic id: `derived-<encounterId>-<rule>` */
  id: string;
  encounterId: number;
  type: string;
  severity: AlertSeverity;
  message: string;
  patientName: string;
  timestamp: string;
  acknowledged: boolean;
}

// ─── Configuration ──────────────────────────────────────────────────────────

/** Alert thresholds (minutes) — tweak as needed */
const THRESHOLDS = {
  /** ADMITTED patients waiting longer than this → warning */
  admittedWaitWarning: 30,
  /** ADMITTED patients waiting longer than this → critical */
  admittedWaitCritical: 60,
  /** TRIAGE patients with no assessment after this → warning */
  triageStaleWarning: 20,
  /** WAITING patients waiting longer than this → warning */
  waitingLongWarning: 45,
  /** WAITING patients waiting longer than this → critical */
  waitingLongCritical: 90,
};

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

type DerivationRule = (enc: Encounter) => DerivedAlert | null;

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
const highAcuityWaiting: DerivationRule = (enc) => {
  if (enc.currentCtasLevel !== 2) return null;
  if (enc.status !== 'ADMITTED') return null;
  const mins = minutesSince(enc.arrivedAt);
  if (mins < THRESHOLDS.admittedWaitWarning) return null;
  return {
    id: `derived-${enc.id}-ctas2-admitted-long`,
    encounterId: enc.id,
    type: 'CTAS2_LONG_WAIT',
    severity: mins >= THRESHOLDS.admittedWaitCritical ? 'CRITICAL' : 'HIGH',
    message: `${patientDisplayName(enc)} (CTAS-2) admitted ${Math.round(mins)} min ago — not yet triaged`,
    patientName: patientDisplayName(enc),
    timestamp: enc.updatedAt,
    acknowledged: false,
  };
};

/**
 * Any patient in ADMITTED status for too long without being moved forward.
 */
const admittedTooLong: DerivationRule = (enc) => {
  if (enc.status !== 'ADMITTED') return null;
  // Skip if a more specific acuity rule already fired
  if (enc.currentCtasLevel === 1 || enc.currentCtasLevel === 2) return null;
  const mins = minutesSince(enc.arrivedAt);
  if (mins < THRESHOLDS.admittedWaitCritical) return null;
  return {
    id: `derived-${enc.id}-admitted-long`,
    encounterId: enc.id,
    type: 'ADMITTED_LONG_WAIT',
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
const triageStale: DerivationRule = (enc) => {
  if (enc.status !== 'TRIAGE') return null;
  const mins = minutesSince(enc.triagedAt ?? enc.updatedAt);
  if (mins < THRESHOLDS.triageStaleWarning) return null;
  return {
    id: `derived-${enc.id}-triage-stale`,
    encounterId: enc.id,
    type: 'TRIAGE_STALE',
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
const waitingTooLong: DerivationRule = (enc) => {
  if (enc.status !== 'WAITING') return null;
  const mins = minutesSince(enc.waitingAt ?? enc.updatedAt);
  if (mins < THRESHOLDS.waitingLongWarning) return null;
  const severity: AlertSeverity =
    mins >= THRESHOLDS.waitingLongCritical ? 'CRITICAL' : 'HIGH';
  return {
    id: `derived-${enc.id}-waiting-long`,
    encounterId: enc.id,
    type: 'WAITING_LONG',
    severity,
    message: `${patientDisplayName(enc)} has been waiting for ${Math.round(mins)} min`,
    patientName: patientDisplayName(enc),
    timestamp: enc.updatedAt,
    acknowledged: false,
  };
};

/**
 * Keyword-based alert for critical chief complaints.
 * Fires when a patient has a worrying chief complaint and hasn't been triaged yet.
 */
const criticalComplaint: DerivationRule = (enc) => {
  if (enc.status !== 'EXPECTED' && enc.status !== 'ADMITTED') return null;
  if (!enc.chiefComplaint) return null;
  const lc = enc.chiefComplaint.toLowerCase();
  const criticalKeywords = [
    'chest pain',
    'difficulty breathing',
    'shortness of breath',
    'unconscious',
    'unresponsive',
    'cardiac arrest',
    'stroke',
    'seizure',
    'severe bleeding',
    'anaphylaxis',
  ];
  const match = criticalKeywords.find(kw => lc.includes(kw));
  if (!match) return null;
  return {
    id: `derived-${enc.id}-critical-complaint`,
    encounterId: enc.id,
    type: 'CRITICAL_COMPLAINT',
    severity: 'HIGH',
    message: `${patientDisplayName(enc)} — "${enc.chiefComplaint}" (not yet triaged)`,
    patientName: patientDisplayName(enc),
    timestamp: enc.createdAt,
    acknowledged: false,
  };
};

// All rules in priority order
const RULES: DerivationRule[] = [
  criticalTriagePending,
  highAcuityWaiting,
  criticalComplaint,
  admittedTooLong,
  triageStale,
  waitingTooLong,
];

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Derive alerts from a list of encounters.
 * Returns alerts sorted by severity (CRITICAL first).
 */
export function deriveAlertsFromEncounters(encounters: Encounter[]): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];

  for (const enc of encounters) {
    for (const rule of RULES) {
      const alert = rule(enc);
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
