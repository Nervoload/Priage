// HospitalApp/src/shared/ui/Badge.tsx
// Reusable badge components for CTAS levels, counts, and status indicators.

interface CTASBadgeProps {
  level: number;
  size?: 'sm' | 'md';
}

const CTAS_COLORS: Record<number, string> = {
  1: 'bg-ctas-1 text-white',
  2: 'bg-ctas-2 text-white',
  3: 'bg-ctas-3 text-white',
  4: 'bg-ctas-4 text-white',
  5: 'bg-ctas-5 text-white',
};

export function CTASBadge({ level, size = 'sm' }: CTASBadgeProps) {
  const sizeClass = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  return (
    <span className={`inline-flex items-center rounded font-bold ${sizeClass} ${CTAS_COLORS[level] ?? 'bg-gray-300 text-gray-700'}`}>
      CTAS {level}
    </span>
  );
}

interface CountBadgeProps {
  count: number;
  variant?: 'green' | 'red' | 'blue' | 'amber' | 'gray';
  className?: string;
}

const COUNT_COLORS: Record<string, string> = {
  green: 'bg-green-500 text-white',
  red: 'bg-red-500 text-white',
  blue: 'bg-blue-500 text-white',
  amber: 'bg-amber-500 text-white',
  gray: 'bg-gray-200 text-gray-600',
};

export function CountBadge({ count, variant = 'green', className = '' }: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={`
        inline-flex items-center justify-center rounded-full
        min-w-[20px] h-5 px-1.5 text-[11px] font-bold leading-none
        ${COUNT_COLORS[variant]}
        ${className}
      `}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

interface AlertIndicatorProps {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  className?: string;
}

const ALERT_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500 text-white animate-pulse-dot',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-amber-500 text-white',
  LOW: 'bg-blue-500 text-white',
};

export function AlertIndicator({ severity, className = '' }: AlertIndicatorProps) {
  return (
    <span
      className={`
        inline-flex items-center justify-center rounded-full
        w-6 h-6 text-[11px] font-bold
        ${ALERT_COLORS[severity]}
        ${className}
      `}
      title={`${severity} alert`}
    >
      !
    </span>
  );
}
