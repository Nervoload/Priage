// HospitalApp/src/shared/ui/StatusPill.tsx
// Color-coded encounter status badge.

import type { EncounterStatus } from '../types/domain';

interface StatusPillProps {
  status: EncounterStatus;
  className?: string;
}

const STATUS_STYLES: Record<EncounterStatus, string> = {
  EXPECTED: 'border-blue-200 bg-blue-50 text-blue-700',
  ADMITTED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  TRIAGE: 'border-amber-200 bg-amber-50 text-amber-700',
  WAITING: 'border-sky-200 bg-sky-50 text-sky-700',
  COMPLETE: 'border-green-200 bg-green-50 text-green-700',
  UNRESOLVED: 'border-gray-200 bg-gray-100 text-gray-600',
  CANCELLED: 'border-red-200 bg-red-50 text-red-700',
};

const STATUS_LABELS: Record<EncounterStatus, string> = {
  EXPECTED: 'Expected',
  ADMITTED: 'Admitted',
  TRIAGE: 'Triage',
  WAITING: 'Waiting',
  COMPLETE: 'Complete',
  UNRESOLVED: 'Unresolved',
  CANCELLED: 'Cancelled',
};

export function StatusPill({ status, className = '' }: StatusPillProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-[4px] border px-2 py-0.5
        font-mono text-[10px] font-semibold uppercase tracking-wide
        ${STATUS_STYLES[status]}
        ${className}
      `}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
