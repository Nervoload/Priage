// backend/src/shared/types/encounter-status.ts
// Shared encounter status constants and display labels.
// This is the single source of truth for encounter statuses across all apps.
// Frontend apps should import or copy this file to stay aligned.

/**
 * Encounter statuses as defined in the Prisma schema.
 * These are the ONLY valid values for Encounter.status.
 *
 * Lifecycle:
 *   EXPECTED → ADMITTED → TRIAGE → WAITING → COMPLETE
 *                ↘         ↗↘        ↗↘
 *                 ←──────←─  ←──────←  → UNRESOLVED
 *   Any non-terminal ──────────────────→ CANCELLED
 */
export const EncounterStatusValues = {
  // Patient-facing (pre-hospital)
  EXPECTED: 'EXPECTED',       // Patient registered intent, not yet arrived
  ADMITTED: 'ADMITTED',       // Patient has arrived and been admitted

  // In-hospital
  TRIAGE: 'TRIAGE',           // Patient is being triaged
  WAITING: 'WAITING',         // Patient is in the waiting room

  // Terminal
  COMPLETE: 'COMPLETE',       // Encounter finished successfully
  UNRESOLVED: 'UNRESOLVED',   // Patient left before completion
  CANCELLED: 'CANCELLED',     // Encounter was cancelled
} as const;

export type EncounterStatusType = typeof EncounterStatusValues[keyof typeof EncounterStatusValues];

/**
 * Human-readable display labels for each status.
 * Use these in UI rendering — do NOT use the raw enum strings.
 */
export const EncounterStatusLabels: Record<EncounterStatusType, string> = {
  EXPECTED: 'Expected',
  ADMITTED: 'Admitted',
  TRIAGE: 'In Triage',
  WAITING: 'Waiting',
  COMPLETE: 'Complete',
  UNRESOLVED: 'Unresolved',
  CANCELLED: 'Cancelled',
};

/**
 * Statuses that are considered terminal (no further transitions possible).
 */
export const TERMINAL_STATUSES: ReadonlySet<EncounterStatusType> = new Set([
  EncounterStatusValues.COMPLETE,
  EncounterStatusValues.UNRESOLVED,
  EncounterStatusValues.CANCELLED,
]);

/**
 * Statuses that indicate the patient is active in the pipeline.
 */
export const ACTIVE_STATUSES: EncounterStatusType[] = [
  EncounterStatusValues.EXPECTED,
  EncounterStatusValues.ADMITTED,
  EncounterStatusValues.TRIAGE,
  EncounterStatusValues.WAITING,
];

/**
 * Frontend status mapping guide.
 *
 * The frontend previously used these names which do NOT exist in the backend:
 *   PRE_TRIAGE → Use EXPECTED
 *   ARRIVED    → Use ADMITTED
 *
 * Backend statuses that exist but were missing from frontend:
 *   UNRESOLVED — must be handled in frontend UI
 */
