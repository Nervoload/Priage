// HospitalApp/src/shared/ui/StatusPill.tsx
// Color-coded encounter status badge.

import type { EncounterStatus } from '../types/domain';

interface StatusPillProps {
  status: EncounterStatus;
  className?: string;
}

const STATUS_STYLES: Record<EncounterStatus, string> = {
  EXPECTED: 'bg-blue-100 text-blue-700',
  ADMITTED: 'bg-indigo-100 text-indigo-700',
  TRIAGE: 'bg-amber-100 text-amber-700',
  WAITING: 'bg-purple-100 text-purple-700',
  COMPLETE: 'bg-green-100 text-green-700',
  UNRESOLVED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<EncounterStatus, string> = {
  EXPECTED: 'Expected',
  ADMITTED: 'Admitted',
  TRIAGE: 'In Triage',
  WAITING: 'Waiting',
  COMPLETE: 'Complete',
  UNRESOLVED: 'Unresolved',
  CANCELLED: 'Cancelled',
};

export function StatusPill({ status, className = '' }: StatusPillProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full
        text-[11px] font-semibold uppercase tracking-wide
        ${STATUS_STYLES[status]}
        ${className}
      `}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
