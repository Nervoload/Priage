import type { EncounterStatus } from './types/domain';

export const ACTIVE_ENCOUNTER_STATUSES: EncounterStatus[] = [
  'EXPECTED',
  'ADMITTED',
  'TRIAGE',
  'WAITING',
];

export const IN_HOSPITAL_STATUSES: EncounterStatus[] = [
  'ADMITTED',
  'TRIAGE',
  'WAITING',
];

export const TERMINAL_ENCOUNTER_STATUSES: EncounterStatus[] = [
  'COMPLETE',
  'UNRESOLVED',
  'CANCELLED',
];

export const ENCOUNTER_STATUS_META: Record<
  EncounterStatus,
  { label: string; shortLabel: string; color: string; bg: string; border: string }
> = {
  EXPECTED: {
    label: 'On the way',
    shortLabel: 'Expected',
    color: '#2053d1',
    bg: '#eef5ff',
    border: '#bfdbfe',
  },
  ADMITTED: {
    label: 'Checked in',
    shortLabel: 'Admitted',
    color: '#0f8c5f',
    bg: '#edfdf5',
    border: '#a7f3d0',
  },
  TRIAGE: {
    label: 'Being assessed',
    shortLabel: 'Triage',
    color: '#c86b06',
    bg: '#fff7e9',
    border: '#fed7aa',
  },
  WAITING: {
    label: 'Waiting for care',
    shortLabel: 'Waiting',
    color: '#7a3ef0',
    bg: '#f6f0ff',
    border: '#ddd6fe',
  },
  COMPLETE: {
    label: 'Visit complete',
    shortLabel: 'Complete',
    color: '#0f8c5f',
    bg: '#edfdf5',
    border: '#a7f3d0',
  },
  UNRESOLVED: {
    label: 'Visit incomplete',
    shortLabel: 'Unresolved',
    color: '#c4453f',
    bg: '#fff1ef',
    border: '#fecaca',
  },
  CANCELLED: {
    label: 'Visit cancelled',
    shortLabel: 'Cancelled',
    color: '#9b1235',
    bg: '#fff1f6',
    border: '#fbcfe8',
  },
};

export function isActiveEncounter(status: EncounterStatus): boolean {
  return ACTIVE_ENCOUNTER_STATUSES.includes(status);
}

export function isInHospitalEncounter(status: EncounterStatus): boolean {
  return IN_HOSPITAL_STATUSES.includes(status);
}

export function isTerminalEncounter(status: EncounterStatus): boolean {
  return TERMINAL_ENCOUNTER_STATUSES.includes(status);
}
