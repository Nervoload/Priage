// formCompleteness — checks an encounter/patient for missing fields that
// admittance staff care about. Returns a structured result so the UI can
// show exactly what's incomplete and generate a targeted reminder message.

import type { Encounter } from '../types/domain';

export interface CompletenessIssue {
  field: string;
  label: string;
  severity: 'required' | 'recommended';
}

export interface CompletenessResult {
  /** 0–100 percentage */
  score: number;
  issues: CompletenessIssue[];
  isComplete: boolean;
}

/** Fields we expect every encounter to have before triage can begin. */
export function checkFormCompleteness(encounter: Encounter): CompletenessResult {
  const issues: CompletenessIssue[] = [];
  const p = encounter.patient;

  // Required fields
  if (!p.firstName) issues.push({ field: 'firstName', label: 'First name', severity: 'required' });
  if (!p.lastName) issues.push({ field: 'lastName', label: 'Last name', severity: 'required' });
  if (!encounter.chiefComplaint) issues.push({ field: 'chiefComplaint', label: 'Chief complaint', severity: 'required' });

  // Recommended fields
  if (!p.phone) issues.push({ field: 'phone', label: 'Phone number', severity: 'recommended' });
  if (!p.age) issues.push({ field: 'age', label: 'Age', severity: 'recommended' });
  if (!p.gender) issues.push({ field: 'gender', label: 'Gender', severity: 'recommended' });
  if (p.allergies == null) issues.push({ field: 'allergies', label: 'Allergies', severity: 'recommended' });
  if (p.conditions == null) issues.push({ field: 'conditions', label: 'Medical conditions', severity: 'recommended' });

  // Pre-triage health info
  const healthInfo = p.optionalHealthInfo as Record<string, unknown> | null;
  if (!healthInfo || Object.keys(healthInfo).length === 0) {
    issues.push({ field: 'optionalHealthInfo', label: 'Pre-triage questionnaire', severity: 'recommended' });
  }

  const totalChecks = 9; // 3 required + 6 recommended
  const score = Math.round(((totalChecks - issues.length) / totalChecks) * 100);

  return {
    score,
    issues,
    isComplete: issues.filter(i => i.severity === 'required').length === 0,
  };
}

/** Build a reminder message listing what's missing, suitable for sending to the patient. */
export function buildReminderMessage(result: CompletenessResult): string {
  const missing = result.issues.map(i => i.label);
  if (missing.length === 0) return '';

  const required = result.issues.filter(i => i.severity === 'required').map(i => i.label);
  const recommended = result.issues.filter(i => i.severity === 'recommended').map(i => i.label);

  const parts: string[] = [
    'Hello! The hospital admittance team is reviewing your information and noticed some details are missing.',
  ];

  if (required.length > 0) {
    parts.push(`Please provide the following required information: ${required.join(', ')}.`);
  }
  if (recommended.length > 0) {
    parts.push(`It would also help to fill in: ${recommended.join(', ')}.`);
  }

  parts.push('Please update your profile in the app. Thank you!');

  return parts.join(' ');
}
