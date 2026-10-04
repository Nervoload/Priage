import type { EncounterStatus } from './types/domain';

export const IN_HOSPITAL_STATUSES: EncounterStatus[] = [
  'ADMITTED',
  'CARE',
  'TRIAGE',
  'WAITING',
];

export const TERMINAL_ENCOUNTER_STATUSES: EncounterStatus[] = [
  'COMPLETE',
  'UNRESOLVED',
  'CANCELLED',
];

export type EncounterStatusTone = 'neutral' | 'amber' | 'blue' | 'green' | 'teal' | 'red';
export type EncounterStatusDot = 'solid' | 'ring' | 'square' | 'check' | 'x';

interface EncounterStatusMeta {
  /** Patient-facing wording. */
  label: string;
  shortLabel: string;
  tone: EncounterStatusTone;
  dot: EncounterStatusDot;
  /** Legacy inline-style colours, kept for screens not yet on the design system. */
  color: string;
  bg: string;
  border: string;
}

const TONE_COLORS: Record<EncounterStatusTone, { color: string; bg: string; border: string }> = {
  neutral: { color: '#4A5167', bg: '#EDF2FA', border: 'transparent' },
  amber: { color: '#8A5300', bg: '#FDF1D8', border: 'transparent' },
  blue: { color: '#0067DE', bg: '#E7EFFB', border: 'transparent' },
  green: { color: '#146C43', bg: '#E5F4EA', border: 'transparent' },
  teal: { color: '#0B6B72', bg: '#E0F3F3', border: 'transparent' },
  red: { color: '#B42318', bg: '#FCE9E7', border: 'transparent' },
};

function meta(label: string, shortLabel: string, tone: EncounterStatusTone, dot: EncounterStatusDot): EncounterStatusMeta {
  return { label, shortLabel, tone, dot, ...TONE_COLORS[tone] };
}

// One status map shared by every patient screen: wording, tone and glyph.
// Read it through encounterStatusMeta.
const ENCOUNTER_STATUS_META: Record<EncounterStatus, EncounterStatusMeta> = {
  INTAKE: meta('Assessment in progress', 'Assessment', 'neutral', 'ring'),
  REQUESTED: meta('Waiting for the clinic to confirm', 'Requested', 'amber', 'ring'),
  EXPECTED: meta('Expected', 'Expected', 'blue', 'solid'),
  ADMITTED: meta('Checked in', 'Checked in', 'green', 'solid'),
  CARE: meta('With your clinician', 'In care', 'teal', 'square'),
  TRIAGE: meta('Being assessed', 'Being assessed', 'teal', 'square'),
  WAITING: meta('Waiting for care', 'Waiting', 'amber', 'solid'),
  COMPLETE: meta('Visit complete', 'Complete', 'neutral', 'check'),
  UNRESOLVED: meta('Visit ended', 'Ended', 'neutral', 'x'),
  CANCELLED: meta('Cancelled', 'Cancelled', 'red', 'x'),
};

// A newer backend can send a status this build has no wording for yet. Like any
// non-terminal status it is an active visit, so it gets neutral in-progress wording.
const UNKNOWN_STATUS_META = meta('Visit in progress', 'In progress', 'neutral', 'ring');

export function encounterStatusMeta(status: EncounterStatus | string): EncounterStatusMeta {
  return Object.prototype.hasOwnProperty.call(ENCOUNTER_STATUS_META, status)
    ? ENCOUNTER_STATUS_META[status as EncounterStatus]
    : UNKNOWN_STATUS_META;
}

/** An active visit is any status that is not terminal, so new statuses count as active by default. */
export function isActiveEncounter(status: EncounterStatus): boolean {
  return !isTerminalEncounter(status);
}

export function isInHospitalEncounter(status: EncounterStatus): boolean {
  return IN_HOSPITAL_STATUSES.includes(status);
}

export function isTerminalEncounter(status: EncounterStatus): boolean {
  return TERMINAL_ENCOUNTER_STATUSES.includes(status);
}

/** Where a visit is shown: clinic visits on their clinic page, ED visits in the encounter workspace. */
export function encounterPath(encounter: { id: number; clinicAlias?: string | null }): string {
  return encounter.clinicAlias
    ? `/clinic/${encodeURIComponent(encounter.clinicAlias)}/visits/${encounter.id}`
    : `/encounters/${encounter.id}/current`;
}
