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
import { StatusPill } from '../../shared/ui/StatusPill';
import {
  DASHBOARD_EMPTY_STATE_CLASS,
  DASHBOARD_GLASS_PANEL_CLASS,
  DASHBOARD_PAGE_CLASS,
  DASHBOARD_STATUS_THEME,
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

const CATEGORY_STYLES: Record<CategoryFilter, { card: string; pill: string }> = {
  unseen: {
    card: 'border-sky-700 bg-sky-700 text-white shadow-[0_20px_45px_-28px_rgba(3,105,161,0.9)]',
    pill: 'border-sky-700 bg-sky-700 text-white shadow-[0_16px_36px_-26px_rgba(3,105,161,0.9)]',
  },
  stale: {
    card: 'border-rose-700 bg-rose-700 text-white shadow-[0_20px_45px_-28px_rgba(190,24,93,0.92)]',
    pill: 'border-rose-700 bg-rose-700 text-white shadow-[0_16px_36px_-26px_rgba(190,24,93,0.92)]',
  },
  incomplete: {
    card: 'border-orange-600 bg-orange-600 text-white shadow-[0_20px_45px_-28px_rgba(234,88,12,0.92)]',
    pill: 'border-orange-600 bg-orange-600 text-white shadow-[0_16px_36px_-26px_rgba(234,88,12,0.92)]',
  },
};

const ADMIT_CARD_GRID_CLASS =
  'grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

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

  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <NavBar
        currentView="admit"
        onNavigate={(view) => onNavigate?.(view)}
        onLogout={() => onBack?.()}
        user={user ?? null}
      />

      <div className="mx-auto max-w-[1840px] px-3 py-4 sm:px-4 sm:py-5 lg:px-5 lg:py-6">
        <div
          className={`${DASHBOARD_GLASS_PANEL_CLASS} transition-all duration-300 ${filtersVisible ? 'mb-7 p-4 sm:p-5' : 'mb-5 p-4'}`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div
              className={`
                relative flex-1 transition-all duration-300
                ${filtersVisible ? 'translate-y-0' : '-translate-y-0.5'}
              `}
            >
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                width="18"
                height="18"
                fill="none"
                viewBox="0 0 16 16"
              >
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m11 11 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search patients, complaints, or chart numbers"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="
                  w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-3 pl-11
                  text-sm font-medium text-slate-700 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.5)]
                  placeholder:text-slate-400
                  focus:border-priage-300 focus:outline-none focus:ring-2 focus:ring-priage-200
                "
              />
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                title="Refresh encounters"
                className="
                  rounded-[16px] border border-priage-200 bg-priage-50/80 px-4 py-3 text-sm font-semibold text-priage-700
                  transition-all hover:border-priage-300 hover:bg-priage-100 hover:text-priage-800
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                Refresh
              </button>
            )}

            {hasCustomFilters && (
              <button
                onClick={() => {
                  setStatusFilters(new Set(DEFAULT_STATUSES));
                  setCategoryFilters(new Set());
                }}
                className="
                  rounded-[16px] border border-orange-200 bg-orange-50/85 px-4 py-3 text-sm font-semibold text-orange-700
                  transition-all hover:border-orange-300 hover:bg-orange-100 hover:text-orange-800
                "
              >
                Reset
              </button>
            )}

            <button
              onClick={() => setFiltersVisible((value) => !value)}
              className="
                rounded-[16px] border border-slate-200 bg-slate-900 px-4 py-3 text-sm font-semibold text-white
                transition-all hover:bg-slate-800
              "
            >
              {filtersVisible ? 'Hide filters' : 'Show filters'}
            </button>
          </div>

          <div
            className={`
              transition-[max-height,margin,padding] duration-300 ease-out
              ${filtersVisible ? 'mt-4 max-h-[620px] overflow-visible px-1 pt-2 pb-1' : 'mt-0 max-h-0 overflow-hidden px-0 pt-0 pb-0'}
            `}
          >
            <div
              className={`
                transition-[opacity,transform] duration-200 ease-out
                ${filtersVisible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}
              `}
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {stats.map((stat) => {
                  const isCategoryActive = stat.category ? categoryFilters.has(stat.category) : false;
                  const isStatusActive = stat.status ? statusFilters.has(stat.status) && statusFilters.size === 1 : false;
                  const isActive = isCategoryActive || isStatusActive;
                  const isClickable = Boolean(stat.category || stat.status);
                  const activeClasses = stat.category
                    ? CATEGORY_STYLES[stat.category].card
                    : DASHBOARD_STATUS_THEME[stat.status!].summary;

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
                        rounded-[22px] border px-4 py-4 transition-all duration-200
                        ${isClickable ? 'cursor-pointer hover:-translate-y-0.5' : ''}
                        ${isActive
                          ? activeClasses
                          : 'border-slate-200/80 bg-white/92 text-slate-900 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] hover:border-slate-300'
                        }
                      `}
                    >
                      <div className={`text-[12px] font-bold uppercase tracking-[0.16em] ${isActive ? 'text-white/78' : 'text-slate-600'}`}>
                        {stat.label}
                      </div>
                      <div className={`mt-2 font-hospital-display text-[2.15rem] font-semibold tracking-[-0.03em] ${isActive ? 'text-white' : 'text-slate-900'}`}>
                        {stat.value}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</span>
                  {STATUS_OPTIONS.map((option) => {
                    const active = statusFilters.has(option.key);
                    const count = encounters.filter((encounter) => encounter.status === option.key).length;
                    const buttonClasses = active ? DASHBOARD_STATUS_THEME[option.key].filterActive : DASHBOARD_STATUS_THEME[option.key].filterIdle;

                    return (
                      <button
                        key={option.key}
                        onClick={() => toggleStatus(option.key)}
                        className={`
                          inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all
                          ${buttonClasses}
                        `}
                      >
                        <span>{option.label}</span>
                        <span className={active ? 'text-white/78' : 'text-current/70'}>{count}</span>
                      </button>
                    );
                  })}

                  <div className="mx-1 h-5 w-px bg-slate-200" />

                  <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Focus</span>
                  {([
                    { key: 'unseen' as CategoryFilter, label: 'Unseen', count: unseenCount },
                    { key: 'stale' as CategoryFilter, label: 'Stale', count: staleCount },
                    { key: 'incomplete' as CategoryFilter, label: 'Incomplete', count: incompleteCount },
                  ]).map((filter) => {
                    const active = categoryFilters.has(filter.key);
                    const buttonClasses = active
                      ? CATEGORY_STYLES[filter.key].pill
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900';

                    return (
                      <button
                        key={filter.key}
                        onClick={() => toggleCategory(filter.key)}
                        className={`
                          inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all
                          ${buttonClasses}
                        `}
                      >
                        <span>{filter.label}</span>
                        <span className={active ? 'text-white/72' : 'text-slate-500'}>{filter.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className={DASHBOARD_EMPTY_STATE_CLASS}>
            Loading encounters…
          </div>
        ) : filteredEncounters.length === 0 ? (
          <div className={DASHBOARD_EMPTY_STATE_CLASS}>
            No patients found
          </div>
        ) : (
          <div className="space-y-6 transition-all duration-300">
            {newArrivals.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 font-hospital-display text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
                  </span>
                  New Arrivals ({newArrivals.length})
                </h2>
                <div className={ADMIT_CARD_GRID_CLASS}>
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

            <section>
              <h2 className="mb-3 flex items-center gap-2 font-hospital-display text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Reviewed ({reviewed.length})
              </h2>
              {reviewed.length === 0 ? (
                <div className="rounded-[26px] border border-slate-200/80 bg-white/90 px-5 py-8 text-center text-sm text-slate-400 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.55)]">
                  {newArrivals.length > 0 ? 'Open new arrivals above to review them' : 'No patients to display'}
                </div>
              ) : (
                <div className={ADMIT_CARD_GRID_CLASS}>
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
  const patientAge = encounter.patient.age != null ? `Age: ${encounter.patient.age}` : 'Age: N/A';
  const statusPillStyle = DASHBOARD_STATUS_THEME[encounter.status].cardPill;
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

  const completenessStyle =
    completeness.score >= 80
      ? 'bg-emerald-100 text-emerald-800 shadow-none'
      : completeness.score >= 50
        ? 'bg-amber-100 text-amber-800 shadow-none'
        : 'bg-rose-100 text-rose-800 shadow-none';

  return (
    <div
      className={`
        group relative flex h-full min-h-[274px] cursor-pointer flex-col overflow-hidden rounded-[28px] border p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.48)]
        transition-all duration-300 hover:-translate-y-1 hover:border-[var(--card-accent)] hover:shadow-[0_28px_70px_-38px_rgba(15,23,42,0.5)]
        ${isNew
          ? isStale
            ? 'border-rose-200/80'
            : 'border-orange-200/80'
          : 'border-slate-200/80'
        }
      `}
      style={{
        backgroundImage: isNew
          ? isStale
            ? 'linear-gradient(180deg, rgba(255,241,242,0.96) 0%, rgba(255,255,255,0.98) 46%, rgba(255,255,255,1) 100%)'
            : 'linear-gradient(180deg, rgba(255,247,237,0.96) 0%, rgba(255,255,255,0.98) 46%, rgba(255,255,255,1) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
        '--card-accent': avatarTheme.accent,
      } as CSSProperties}
      onClick={onClick}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.86),_transparent_65%)]" />

      <div className="relative flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] text-base font-bold text-white shadow-[0_16px_40px_-20px_rgba(15,23,42,0.55)]"
          style={{ backgroundImage: avatarTheme.gradient }}
        >
          {initials}
        </div>

        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-hospital-display text-[1.1rem] font-semibold tracking-[-0.03em] text-slate-900">
              {name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              <span>{patientSex}</span>
              <span>{patientAge}</span>
              <span>#{encounter.id}</span>
            </div>
          </div>

          {isNew && (
            <span
              className={`
                inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em]
                ${isStale ? 'bg-rose-600 text-white' : 'bg-orange-500 text-orange-950'}
              `}
            >
              {isStale ? 'Stale' : 'New'}
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-4 min-h-[3rem]">
        <p
          ref={complaintRef}
          className="line-clamp-2 pr-10 text-[17px] font-semibold leading-6 text-slate-800"
        >
          {complaint}
        </p>
        {isComplaintOverflowing && (
          <div className="pointer-events-none absolute bottom-0 right-0 h-6 w-28 bg-gradient-to-l from-white via-white/95 to-transparent" />
        )}
      </div>

      <div className="relative mt-4 mb-2 flex flex-wrap items-center gap-2">
        <StatusPill
          status={encounter.status}
          className={`rounded-md px-3 py-1.5 text-[11px] font-bold tracking-[0.16em] ${statusPillStyle}`}
        />

        <span className={`inline-flex items-center rounded-md px-3 py-1.5 text-[11px] font-bold ${completenessStyle}`}>
          {completeness.score}% complete
        </span>

        {encounter.currentCtasLevel && (
          <CTASBadge level={encounter.currentCtasLevel as 1 | 2 | 3 | 4 | 5} />
        )}

        {encounter.priagePreview?.recommendedCtasLevel != null && (
          <span className="inline-flex items-center rounded-md bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-800">
            AI CTAS {encounter.priagePreview.recommendedCtasLevel}
          </span>
        )}

        {encounter.priagePreview && encounter.priagePreview.progressionRiskCount > 0 && (
          <span className="inline-flex items-center rounded-md bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700">
            {encounter.priagePreview.progressionRiskCount} watch item{encounter.priagePreview.progressionRiskCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="relative mt-auto pt-4">
        <div className="absolute inset-x-0 top-0 h-px bg-slate-200/80" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-nowrap items-center gap-2 text-xs text-slate-500">
            <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Arrived</span>
            <span className="whitespace-nowrap text-[13px] font-semibold text-slate-700">{formatTime(arrivalAt)}</span>
          </div>

          <span
            className={`
              inline-flex shrink-0 whitespace-nowrap items-center rounded-full px-3 py-1 text-[11px] font-semibold
              ${isStale
                ? 'bg-rose-100 text-rose-700'
                : isNew
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-slate-100 text-slate-600'
              }
            `}
          >
            {formatDashboardElapsedMinutes(arrivalMinutes)} {isNew ? 'unseen' : 'since arrival'}
          </span>
        </div>
      </div>
    </div>
  );
}
