// HospitalApp/src/features/admit/AdmitView.tsx
// Admittance dashboard — reorganized for fast intake review with
// collapsible filters and higher-information patient cards.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AdmitDetailPanel } from './AdmitDetailPanel';
import type { Encounter, EncounterDetail, EncounterListItem } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import type { EncounterStatus } from '../../shared/types/domain';
import { NavBar, type View } from '../../shared/ui/NavBar';
import { CTASBadge } from '../../shared/ui/Badge';
import {
  formatDashboardElapsedMinutes,
  formatDashboardPatientSex,
  getDashboardAvatarTheme,
  getDashboardInitials,
} from '../../shared/ui/dashboardTheme';
import { useSeenEncounters } from '../../shared/hooks/useSeenEncounters';
import { checkFormCompleteness } from '../../shared/hooks/formCompleteness';
import { useToast } from '../../shared/ui/ToastContext';
import { getEncounter } from '../../shared/api/encounters';
import { sendMessage } from '../../shared/api/messaging';

interface AdmitViewProps {
  onBack?: () => void;
  onNavigate?: (view: View) => void;
  encounters: EncounterListItem[];
  onAdmit: (encounter: Encounter) => void | Promise<void>;
  loading?: boolean;
  onRefresh?: () => void;
  user?: { email: string; role: string } | null;
}

type CategoryFilter = 'unseen' | 'stale' | 'incomplete';

const STALE_MINUTES = 120;

const STATUS_OPTIONS: { key: EncounterStatus; label: string }[] = [
  { key: 'EXPECTED', label: 'Expected' },
  { key: 'ADMITTED', label: 'Admitted' },
  { key: 'TRIAGE', label: 'Triage' },
  { key: 'WAITING', label: 'Waiting' },
  { key: 'COMPLETE', label: 'Complete' },
];

const DEFAULT_STATUSES = new Set<EncounterStatus>(['EXPECTED', 'ADMITTED']);

const ADMIT_PAGE_CLASS = 'min-h-screen bg-[#f8fafc] font-sans';

const ADMIT_PANEL_CLASS =
  'rounded-[10px] border border-[#e2e8f0] bg-white transition-all duration-300';

const ADMIT_EMPTY_CLASS =
  'rounded-[10px] border border-[#e2e8f0] bg-white px-5 py-12 text-center text-sm text-slate-500';

const STAT_TOP_ACCENT: Record<string, string> = {
  Unseen: 'bg-[#ef4444]',
  Expecting: 'bg-[#3b82f6]',
  Admitted: 'bg-[#10b981]',
  'Stale (2h+)': 'bg-[#f59e0b]',
  Incomplete: 'bg-[#8b5cf6]',
};

const STAT_SPARKLINE_HINT: Record<string, string> = {
  Unseen: 'vs last hour',
  Expecting: '—',
  Admitted: '—',
  'Stale (2h+)': 'vs last hour',
  Incomplete: '—',
};

/** Narrow column: cards stay compact (not full-bleed) while fitting name, complaint, and badges. */
const ADMIT_PATIENT_COLUMN_CLASS = 'w-full max-w-sm';

const ADMIT_CARD_LIST_CLASS = 'grid w-full grid-cols-1 gap-3';

function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60_000);
}

function getArrivalTimestamp(encounter: Encounter): string {
  return encounter.arrivedAt ?? encounter.createdAt;
}

export function AdmitView({ onBack, onNavigate, encounters, onAdmit, loading, onRefresh, user }: AdmitViewProps) {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<Set<EncounterStatus>>(new Set(DEFAULT_STATUSES));
  const [categoryFilters, setCategoryFilters] = useState<Set<CategoryFilter>>(new Set());
  const [selectedEncounter, setSelectedEncounter] = useState<EncounterDetail | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const { markSeen, seenIds } = useSeenEncounters();

  // Keep time-based stale badges and counters fresh while the dashboard stays open.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => forceTick((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleStatus = (status: EncounterStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const toggleCategory = (cat: CategoryFilter) => {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const filteredEncounters = useMemo(() => {
    let filtered = encounters;

    if (statusFilters.size > 0) {
      filtered = filtered.filter((encounter) => statusFilters.has(encounter.status));
    }

    if (categoryFilters.has('unseen')) {
      filtered = filtered.filter((encounter) => !seenIds.has(encounter.id));
    }
    if (categoryFilters.has('stale')) {
      filtered = filtered.filter(
        (encounter) => !seenIds.has(encounter.id) && minutesSince(getArrivalTimestamp(encounter)) >= STALE_MINUTES,
      );
    }
    if (categoryFilters.has('incomplete')) {
      filtered = filtered.filter((encounter) => checkFormCompleteness(encounter).score < 80);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((encounter) =>
        patientName(encounter.patient).toLowerCase().includes(query) ||
        (encounter.chiefComplaint ?? '').toLowerCase().includes(query) ||
        String(encounter.id).includes(searchQuery),
      );
    }

    return filtered;
  }, [categoryFilters, encounters, searchQuery, seenIds, statusFilters]);

  const newArrivals = useMemo(
    () => filteredEncounters
      .filter((encounter) => encounter.status === 'EXPECTED')
      .sort((a, b) => new Date(getArrivalTimestamp(b)).getTime() - new Date(getArrivalTimestamp(a)).getTime()),
    [filteredEncounters],
  );

  const reviewed = useMemo(
    () => filteredEncounters
      .filter((encounter) => encounter.status !== 'EXPECTED')
      .sort((a, b) => new Date(getArrivalTimestamp(b)).getTime() - new Date(getArrivalTimestamp(a)).getTime()),
    [filteredEncounters],
  );

  const handleSelectEncounter = async (encounter: EncounterListItem) => {
    markSeen(encounter.id);
    try {
      const detail = await getEncounter(encounter.id);
      setSelectedEncounter(detail);
    } catch {
      showToast('Could not load patient detail. Please try again.', 'error');
    }
  };

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const unseenCount = encounters.filter((encounter) => !seenIds.has(encounter.id)).length;
  const expecting = encounters.filter((encounter) => encounter.status === 'EXPECTED').length;
  const inAdmittance = encounters.filter((encounter) => encounter.status === 'ADMITTED').length;
  const staleCount = encounters.filter(
    (encounter) => !seenIds.has(encounter.id) && minutesSince(getArrivalTimestamp(encounter)) >= STALE_MINUTES,
  ).length;
  const incompleteCount = encounters.filter((encounter) => checkFormCompleteness(encounter).score < 80).length;

  const stats: { label: string; value: number; category?: CategoryFilter; status?: EncounterStatus }[] = [
    { label: 'Unseen', value: unseenCount, category: 'unseen' },
    { label: 'Expecting', value: expecting, status: 'EXPECTED' },
    { label: 'Admitted', value: inAdmittance, status: 'ADMITTED' },
    { label: 'Stale (2h+)', value: staleCount, category: 'stale' },
    { label: 'Incomplete', value: incompleteCount, category: 'incomplete' },
  ];

  const hasCustomFilters =
    statusFilters.size !== DEFAULT_STATUSES.size ||
    ![...DEFAULT_STATUSES].every((status) => statusFilters.has(status)) ||
    categoryFilters.size > 0;

  const filterRowActive = 'rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white transition';
  const filterRowIdle =
    'rounded-md px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900';

  return (
    <div className={ADMIT_PAGE_CLASS}>
      <NavBar
        currentView="admit"
        onNavigate={(view) => onNavigate?.(view)}
        onLogout={() => onBack?.()}
        user={user ?? null}
      />
      <div className="border-b border-[#e2e8f0]" aria-hidden />

      <div className="mx-auto max-w-7xl px-8 py-6">
        <div className={`${ADMIT_PANEL_CLASS} ${filtersVisible ? 'mb-6 p-5' : 'mb-6 p-4'}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div
              className={`
                relative flex-1 transition-all duration-300
                ${filtersVisible ? 'translate-y-0' : '-translate-y-0.5'}
              `}
            >
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
              >
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1" />
                <path d="m11 11 3 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search patients, complaints, or chart numbers"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="
                  h-[44px] w-full rounded-[8px] border border-[#e2e8f0] bg-white pl-10 pr-3
                  text-sm text-slate-800 placeholder:text-slate-300
                  focus:border-[#3b82f6] focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]
                "
              />
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                title="Refresh encounters"
                className="
                  h-[44px] shrink-0 rounded-[8px] border border-[#e2e8f0] bg-white px-4 text-sm font-semibold text-slate-600
                  transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                Refresh
              </button>
            )}

            {hasCustomFilters && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilters(new Set(DEFAULT_STATUSES));
                  setCategoryFilters(new Set());
                }}
                className="
                  h-[44px] shrink-0 rounded-[8px] border border-[#e2e8f0] bg-white px-4 text-sm font-semibold text-slate-600
                  transition hover:bg-slate-50
                "
              >
                Reset
              </button>
            )}

            <button
              type="button"
              onClick={() => setFiltersVisible((value) => !value)}
              className="
                h-[44px] shrink-0 rounded-[8px] bg-slate-900 px-4 text-sm font-semibold text-white
                transition hover:bg-slate-700
              "
            >
              {filtersVisible ? 'Hide filters' : 'Show filters'}
            </button>
          </div>

          <div
            className={`
              transition-[max-height,margin,padding] duration-300 ease-out
              ${filtersVisible ? 'mt-5 max-h-[720px] overflow-visible' : 'mt-0 max-h-0 overflow-hidden'}
            `}
          >
            <div
              className={`
                transition-[opacity,transform] duration-200 ease-out
                ${filtersVisible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}
              `}
            >
              <div className="grid h-full grid-cols-2 gap-3 lg:grid-cols-5">
                {stats.map((stat) => {
                  const isCategoryActive = stat.category ? categoryFilters.has(stat.category) : false;
                  const isStatusActive = stat.status ? statusFilters.has(stat.status) && statusFilters.size === 1 : false;
                  const isActive = isCategoryActive || isStatusActive;
                  const isClickable = Boolean(stat.category || stat.status);
                  const accent = STAT_TOP_ACCENT[stat.label] ?? 'bg-slate-300';
                  const hint = STAT_SPARKLINE_HINT[stat.label] ?? '—';

                  return (
                    <div
                      key={stat.label}
                      onClick={() => {
                        if (stat.category) {
                          toggleCategory(stat.category);
                        } else if (stat.status) {
                          if (isStatusActive) {
                            setStatusFilters(new Set(DEFAULT_STATUSES));
                          } else {
                            setStatusFilters(new Set([stat.status]));
                          }
                        }
                      }}
                      className={`
                        flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-white
                        ${isActive ? 'border-slate-900' : 'border-[#e2e8f0]'}
                        ${isClickable ? 'cursor-pointer transition hover:border-[#cbd5e1]' : ''}
                      `}
                    >
                      <div className={`h-[3px] w-full shrink-0 ${accent}`} aria-hidden />
                      <div className="flex flex-1 flex-col p-5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                          {stat.label}
                        </div>
                        <div className="mt-2 text-[2.5rem] font-bold leading-none text-slate-800">{stat.value}</div>
                        <div className="mt-2 text-[11px] text-slate-300">{hint}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2">
                {STATUS_OPTIONS.map((option) => {
                  const active = statusFilters.has(option.key);
                  const count = encounters.filter((encounter) => encounter.status === option.key).length;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => toggleStatus(option.key)}
                      className={`inline-flex items-baseline gap-1.5 ${active ? filterRowActive : filterRowIdle}`}
                    >
                      <span className="font-sans font-semibold">{option.label}</span>
                      <span
                        className={`text-[10px] font-mono ${active ? 'text-slate-300' : 'text-slate-400'}`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}

                <div className="mx-2 h-4 w-px shrink-0 self-center bg-[#e2e8f0]" aria-hidden />

                {([
                  { key: 'unseen' as CategoryFilter, label: 'Unseen', count: unseenCount },
                  { key: 'stale' as CategoryFilter, label: 'Stale', count: staleCount },
                  { key: 'incomplete' as CategoryFilter, label: 'Incomplete', count: incompleteCount },
                ]).map((filter) => {
                  const active = categoryFilters.has(filter.key);

                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => toggleCategory(filter.key)}
                      className={`inline-flex items-baseline gap-1.5 ${active ? filterRowActive : filterRowIdle}`}
                    >
                      <span className="font-sans font-semibold">{filter.label}</span>
                      <span
                        className={`text-[10px] font-mono ${active ? 'text-slate-300' : 'text-slate-400'}`}
                      >
                        {filter.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className={ADMIT_EMPTY_CLASS}>Loading encounters…</div>
        ) : filteredEncounters.length === 0 ? (
          <div className={ADMIT_EMPTY_CLASS}>No patients found</div>
        ) : (
          <div className="space-y-6 transition-all duration-300">
            {newArrivals.length > 0 && (
              <section className={ADMIT_PATIENT_COLUMN_CLASS}>
                <AdmitSectionHeaderNewArrivals count={newArrivals.length} />
                <div className={ADMIT_CARD_LIST_CLASS}>
                  {newArrivals.map((encounter) => (
                    <EncounterCard
                      key={encounter.id}
                      encounter={encounter}
                      isNew
                      isStale={minutesSince(getArrivalTimestamp(encounter)) >= STALE_MINUTES}
                      getInitials={getDashboardInitials}
                      formatTime={formatTime}
                      onClick={() => void handleSelectEncounter(encounter)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className={ADMIT_PATIENT_COLUMN_CLASS}>
              <AdmitSectionHeaderReviewed count={reviewed.length} />
              {reviewed.length === 0 ? (
                <div className="w-full rounded-[10px] border border-[#e2e8f0] bg-white px-5 py-8 text-center text-sm text-slate-400">
                  {newArrivals.length > 0 ? 'Open new arrivals above to review them' : 'No patients to display'}
                </div>
              ) : (
                <div className={ADMIT_CARD_LIST_CLASS}>
                  {reviewed.map((encounter) => (
                    <EncounterCard
                      key={encounter.id}
                      encounter={encounter}
                      isNew={false}
                      isStale={minutesSince(getArrivalTimestamp(encounter)) >= STALE_MINUTES}
                      getInitials={getDashboardInitials}
                      formatTime={formatTime}
                      onClick={() => void handleSelectEncounter(encounter)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {selectedEncounter && (
        <AdmitDetailPanel
          encounter={selectedEncounter}
          onClose={() => setSelectedEncounter(null)}
          onAdmit={(encounter) => {
            onAdmit(encounter);
            setSelectedEncounter(null);
          }}
          onSendReminder={async (encounter, message) => {
            await sendMessage(encounter.id, { content: message });
          }}
        />
      )}
    </div>
  );
}

function AdmitSectionHeaderNewArrivals({ count }: { count: number }) {
  return (
    <div className="mb-3 flex min-w-0 items-center gap-3">
      <div className="flex min-w-0 shrink-0 items-baseline gap-2 border-l-2 border-l-[#ef4444] pl-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">New Arrivals</span>
        <span className="font-mono text-sm text-slate-400">({count})</span>
      </div>
      <div className="h-px min-w-[2rem] flex-1 bg-[#f1f5f9]" aria-hidden />
    </div>
  );
}

function AdmitSectionHeaderReviewed({ count }: { count: number }) {
  return (
    <div className="mb-3 flex min-w-0 items-center gap-3">
      <div className="flex min-w-0 shrink-0 items-baseline gap-2 border-l-2 border-l-[#e2e8f0] pl-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Reviewed</span>
        <span className="font-mono text-sm text-slate-400">({count})</span>
      </div>
      <div className="h-px min-w-[2rem] flex-1 bg-[#f1f5f9]" aria-hidden />
    </div>
  );
}

function encounterLaneStripeClass(encounter: EncounterListItem, isStale: boolean): string {
  if (isStale) return 'bg-[#ef4444]';
  if (encounter.status === 'EXPECTED') return 'bg-[#3b82f6]';
  if (encounter.status === 'ADMITTED') return 'bg-[#10b981]';
  return 'bg-[#cbd5e1]';
}

const STATUS_BADGE_BASE =
  'inline-flex items-center border font-mono text-[10px] font-semibold uppercase tracking-wide rounded-[4px] px-2 py-0.5';

const STATUS_BADGE_BY_STATUS: Record<EncounterStatus, string> = {
  EXPECTED: `${STATUS_BADGE_BASE} border-blue-200 bg-blue-50 text-blue-600`,
  ADMITTED: `${STATUS_BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-600`,
  TRIAGE: `${STATUS_BADGE_BASE} border-slate-200 bg-slate-50 text-slate-600`,
  WAITING: `${STATUS_BADGE_BASE} border-slate-200 bg-slate-50 text-slate-600`,
  COMPLETE: `${STATUS_BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-600`,
  UNRESOLVED: `${STATUS_BADGE_BASE} border-slate-200 bg-slate-50 text-slate-600`,
  CANCELLED: `${STATUS_BADGE_BASE} border-red-200 bg-red-50 text-red-600`,
};

function EncounterCard({
  encounter,
  isNew,
  isStale,
  getInitials,
  formatTime,
  onClick,
}: {
  encounter: EncounterListItem;
  isNew: boolean;
  isStale: boolean;
  getInitials: (name: string) => string;
  formatTime: (d: string) => string;
  onClick: () => void;
}) {
  const name = patientName(encounter.patient);
  const initials = getInitials(name);
  const avatarTheme = getDashboardAvatarTheme(encounter.patientId);
  const complaintRef = useRef<HTMLParagraphElement | null>(null);
  const completeness = checkFormCompleteness(encounter);
  const arrivalAt = getArrivalTimestamp(encounter);
  const arrivalMinutes = minutesSince(arrivalAt);
  const complaint = encounter.chiefComplaint ?? 'No chief complaint recorded';
  const patientSex = formatDashboardPatientSex(encounter.patient.gender);
  const patientAge = encounter.patient.age != null ? `${encounter.patient.age}` : '—';
  const laneStripe = encounterLaneStripeClass(encounter, isStale);
  const [isComplaintOverflowing, setIsComplaintOverflowing] = useState(false);

  useEffect(() => {
    const element = complaintRef.current;
    if (!element) return;

    const checkOverflow = () => {
      setIsComplaintOverflowing(element.scrollHeight - element.clientHeight > 2);
    };

    checkOverflow();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', checkOverflow);
      return () => window.removeEventListener('resize', checkOverflow);
    }

    const observer = new ResizeObserver(() => checkOverflow());
    observer.observe(element);

    return () => observer.disconnect();
  }, [complaint]);

  const completenessBadge =
    completeness.score >= 80
      ? `${STATUS_BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-600`
      : completeness.score >= 50
        ? `${STATUS_BADGE_BASE} border-amber-200 bg-amber-50 text-amber-600`
        : `${STATUS_BADGE_BASE} border-red-200 bg-red-50 text-red-600`;

  const statusLabel = encounter.status.split('_').join(' ');

  return (
    <div
      className="flex w-full max-w-full cursor-pointer overflow-hidden rounded-[10px] border border-[#e2e8f0] bg-white transition-colors hover:border-[#cbd5e1]"
      onClick={onClick}
    >
      <div className={`w-1 shrink-0 self-stretch ${laneStripe}`} aria-hidden />
      <div className="min-w-0 flex-1 p-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-start gap-x-4 gap-y-1">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] font-mono text-sm font-bold text-white"
            style={{ backgroundImage: avatarTheme.gradient } as CSSProperties}
          >
            {initials}
          </div>

          <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 font-semibold text-[15px] leading-tight text-slate-800">{name}</div>
            {isNew && (
              <span
                className={`
                  shrink-0 ${STATUS_BADGE_BASE}
                  ${isStale ? 'border-red-200 bg-red-50 text-red-600' : 'border-blue-200 bg-blue-50 text-blue-600'}
                `}
              >
                {isStale ? 'Stale' : 'New'}
              </span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-[11px] tracking-wide text-slate-400">
            {patientSex} / AGE {patientAge} / #{encounter.id}
          </div>
          <p ref={complaintRef} className="relative mt-0.5 line-clamp-2 text-sm text-slate-600">
            {complaint}
            {isComplaintOverflowing && (
              <span
                className="pointer-events-none absolute bottom-0 right-0 block h-5 w-16 bg-gradient-to-l from-white to-transparent"
                aria-hidden
              />
            )}
          </p>
          </div>

          <div className="flex flex-col items-end gap-1 text-right font-mono text-[11px] text-slate-400">
            <span>{formatTime(arrivalAt)}</span>
            {isNew ? (
              <span
                className="rounded-[4px] border border-red-100 bg-red-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-red-500"
              >
                {formatDashboardElapsedMinutes(arrivalMinutes)} unseen
              </span>
            ) : (
              <span className="font-mono text-[10px] text-slate-400">
                {formatDashboardElapsedMinutes(arrivalMinutes)} since
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-[#f1f5f9] pt-3">
        <span className={STATUS_BADGE_BY_STATUS[encounter.status]}>{statusLabel}</span>

        <span className={completenessBadge}>{completeness.score}%</span>

        {encounter.currentCtasLevel && (
          <span className="[&>span]:rounded-[4px] [&>span]:border [&>span]:border-slate-200 [&>span]:bg-slate-50 [&>span]:px-2 [&>span]:py-0.5 [&>span]:font-mono [&>span]:text-[10px] [&>span]:font-semibold [&>span]:uppercase [&>span]:text-slate-600">
            <CTASBadge level={encounter.currentCtasLevel as 1 | 2 | 3 | 4 | 5} />
          </span>
        )}

        {encounter.priagePreview?.recommendedCtasLevel != null && (
          <span
            className={`${STATUS_BADGE_BASE} border-violet-200 bg-violet-50 text-violet-600`}
          >
            AI CTAS {encounter.priagePreview.recommendedCtasLevel}
          </span>
        )}

        {encounter.priagePreview && encounter.priagePreview.progressionRiskCount > 0 && (
          <span className={`${STATUS_BADGE_BASE} border-amber-200 bg-amber-50 text-amber-600`}>
            {encounter.priagePreview.progressionRiskCount} watch
          </span>
        )}
        </div>
      </div>
    </div>
  );
}
