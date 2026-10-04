// HospitalApp/src/shared/ui/StatusPill.tsx
// Color-coded encounter status badge.

import type { EncounterStatus } from '../types/domain';

interface StatusPillProps {
  status: EncounterStatus;
  className?: string;
  workflowProfile?: 'ED' | 'CLINIC_APPOINTMENT';
}

const STATUS_STYLES: Record<EncounterStatus, string> = {
  INTAKE: 'bg-blue-100 text-blue-700',
  REQUESTED: 'bg-amber-100 text-amber-700',
  EXPECTED: 'bg-blue-100 text-blue-700',
  ADMITTED: 'bg-indigo-100 text-indigo-700',
  CARE: 'bg-violet-100 text-violet-700',
  TRIAGE: 'bg-amber-100 text-amber-700',
  WAITING: 'bg-sky-100 text-sky-700',
  COMPLETE: 'bg-green-100 text-green-700',
  UNRESOLVED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<EncounterStatus, string> = {
  INTAKE: 'Intake',
  REQUESTED: 'Requested',
  EXPECTED: 'Expected',
  ADMITTED: 'Admitted',
  CARE: 'Care',
  TRIAGE: 'Triage',
  WAITING: 'Waiting',
  COMPLETE: 'Complete',
  UNRESOLVED: 'Unresolved',
  CANCELLED: 'Cancelled',
};

export function StatusPill({ status, className = '', workflowProfile = 'ED' }: StatusPillProps) {
  const clinicLabel: Partial<Record<EncounterStatus, string>> = {
    INTAKE: 'Assessment', REQUESTED: 'Time requested', ADMITTED: 'Arrived',
  };
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full
        text-[11px] font-semibold uppercase tracking-wide
        ${STATUS_STYLES[status]}
        ${className}
      `}
    >
      {workflowProfile === 'CLINIC_APPOINTMENT' ? clinicLabel[status] || STATUS_LABELS[status] : STATUS_LABELS[status]}
    </span>
  );
}
