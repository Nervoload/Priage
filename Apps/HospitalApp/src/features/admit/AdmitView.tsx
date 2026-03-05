// HospitalApp/src/features/admit/AdmitView.tsx
// Admittance dashboard — two-section layout:
//   1. New Arrivals (unseen profiles) — prominent, sorted newest-first
//   2. Reviewed (seen profiles) — the pool of expected/admitted patients

import { useState, useMemo } from 'react';
import { AdmitDetailPanel } from './AdmitDetailPanel';
import type { Encounter } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import type { EncounterStatus } from '../../shared/types/domain';
import { NavBar, type View } from '../../shared/ui/NavBar';
import { CTASBadge } from '../../shared/ui/Badge';
import { StatusPill } from '../../shared/ui/StatusPill';
import { useSeenEncounters } from '../../shared/hooks/useSeenEncounters';
import { checkFormCompleteness } from '../../shared/hooks/formCompleteness';
import { sendMessage } from '../../shared/api/messaging';

interface AdmitViewProps {
  onBack?: () => void;
  onNavigate?: (view: View) => void;
  encounters: Encounter[];
  onAdmit: (encounter: Encounter) => void | Promise<void>;
  loading?: boolean;
  onRefresh?: () => void;
  user?: { email: string; role: string } | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

const STALE_MINUTES = 45;

type CategoryFilter = 'unseen' | 'stale' | 'incomplete';

const STATUS_OPTIONS: { key: EncounterStatus; label: string }[] = [
  { key: 'EXPECTED', label: 'Expected' },
  { key: 'ADMITTED', label: 'Admitted' },
  { key: 'TRIAGE', label: 'In Triage' },
  { key: 'WAITING', label: 'Waiting' },
  { key: 'COMPLETE', label: 'Complete' },
];

const DEFAULT_STATUSES = new Set<EncounterStatus>(['EXPECTED', 'ADMITTED']);

export function AdmitView({ onBack, onNavigate, encounters, onAdmit, loading, onRefresh, user }: AdmitViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<Set<EncounterStatus>>(new Set(DEFAULT_STATUSES));
  const [categoryFilters, setCategoryFilters] = useState<Set<CategoryFilter>>(new Set());
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const { markSeen, seenIds } = useSeenEncounters();

  // ─── Status toggle ───────────────────────────────────────────────────

  const toggleStatus = (status: EncounterStatus) => {
    setStatusFilters(prev => {
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
    setCategoryFilters(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  // ─── Filter ──────────────────────────────────────────────────────────

  const filteredEncounters = useMemo(() => {
    let filtered = encounters;

    // Status filter (OR within statuses — show patients matching ANY checked status)
    if (statusFilters.size > 0) {
      filtered = filtered.filter(e => statusFilters.has(e.status));
    }

    // Category filters (AND — each active category further restricts)
    if (categoryFilters.has('unseen')) {
      filtered = filtered.filter(e => !seenIds.has(e.id));
    }
    if (categoryFilters.has('stale')) {
      filtered = filtered.filter(e => !seenIds.has(e.id) && minutesSince(e.createdAt) >= STALE_MINUTES);
    }
    if (categoryFilters.has('incomplete')) {
      filtered = filtered.filter(e => checkFormCompleteness(e).score < 80);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        patientName(e.patient).toLowerCase().includes(q) ||
        (e.chiefComplaint ?? '').toLowerCase().includes(q) ||
        String(e.id).includes(searchQuery),
      );
    }
    return filtered;
  }, [searchQuery, statusFilters, categoryFilters, encounters, seenIds]);

  // ─── Split unseen vs seen ────────────────────────────────────────────

  const unseen = useMemo(
    () => filteredEncounters
      .filter(e => !seenIds.has(e.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filteredEncounters, seenIds],
  );

  const seen = useMemo(
    () => filteredEncounters
      .filter(e => seenIds.has(e.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filteredEncounters, seenIds],
  );

  // ─── Open panel & mark as seen ───────────────────────────────────────

  const handleSelectEncounter = (enc: Encounter) => {
    markSeen(enc.id);
    setSelectedEncounter(enc);
  };

  // ─── Helpers ─────────────────────────────────────────────────────────

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Summary stats (computed from ALL encounters, not filtered)
  const unseenCount = encounters.filter(e => !seenIds.has(e.id)).length;
  const expecting = encounters.filter(e => e.status === 'EXPECTED').length;
  const inAdmittance = encounters.filter(e => e.status === 'ADMITTED').length;
  const staleCount = encounters.filter(e => !seenIds.has(e.id) && minutesSince(e.createdAt) >= STALE_MINUTES).length;
  const incompleteCount = encounters.filter(e => checkFormCompleteness(e).score < 80).length;

  const stats: { label: string; value: number; highlight: boolean; category?: CategoryFilter; status?: EncounterStatus }[] = [
    { label: 'Unseen', value: unseenCount, highlight: unseenCount > 0, category: 'unseen' },
    { label: 'Expecting', value: expecting, highlight: false, status: 'EXPECTED' },
    { label: 'Admitted', value: inAdmittance, highlight: false, status: 'ADMITTED' },
    { label: 'Stale (45m+)', value: staleCount, highlight: staleCount > 0, category: 'stale' },
    { label: 'Incomplete', value: incompleteCount, highlight: incompleteCount > 0, category: 'incomplete' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        currentView="admit"
        onNavigate={(v) => onNavigate?.(v)}
        onLogout={() => onBack?.()}
        user={user ?? null}
      />

      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Summary Cards — clickable to toggle category filters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {stats.map((s) => {
            const isCatActive = s.category ? categoryFilters.has(s.category) : false;
            const isStatusActive = s.status ? statusFilters.has(s.status) && statusFilters.size === 1 : false;
            const isActive = isCatActive || isStatusActive;
            const isClickable = !!(s.category || s.status);
            return (
              <div
                key={s.label}
                onClick={() => {
                  if (s.category) toggleCategory(s.category);
                  else if (s.status) {
                    // Solo-toggle: if already the only active status, reset to defaults
                    if (isStatusActive) {
                      setStatusFilters(new Set(DEFAULT_STATUSES));
                    } else {
                      setStatusFilters(new Set([s.status]));
                    }
                  }
                }}
                className={`
                  rounded-xl border shadow-sm p-4 transition-all
                  ${isClickable ? 'cursor-pointer hover:shadow-md' : ''}
                  ${isActive
                    ? 'bg-priage-50 border-priage-400 ring-2 ring-priage-300'
                    : s.highlight
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-white border-gray-200'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</div>
                  {isActive && (
                    <span className="text-[9px] font-bold text-priage-600 bg-priage-100 px-1.5 py-0.5 rounded">FILTER</span>
                  )}
                </div>
                <div className={`text-2xl font-bold mt-1 ${
                  isActive ? 'text-priage-700' : s.highlight ? 'text-amber-700' : 'text-gray-900'
                }`}>
                  {s.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Search & Compound Filters */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Row 1: Search + Refresh */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" fill="none" viewBox="0 0 16 16">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="m11 11 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search patients…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-priage-300"
              />
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                title="Refresh encounters"
                className="px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
              >
                ↻
              </button>
            )}
          </div>

          {/* Row 2: Status toggles + category pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mr-1">Status:</span>
            {STATUS_OPTIONS.map(opt => {
              const active = statusFilters.has(opt.key);
              const count = encounters.filter(e => e.status === opt.key).length;
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleStatus(opt.key)}
                  className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border
                    ${active
                      ? 'bg-priage-600 text-white border-priage-600 shadow-sm'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-priage-300 hover:text-priage-600'
                    }
                  `}
                >
                  {/* Checkbox indicator */}
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    active ? 'bg-white/20 border-white/40' : 'border-gray-300'
                  }`}>
                    {active && (
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {opt.label}
                  <span className={`${active ? 'text-white/70' : 'text-gray-400'}`}>{count}</span>
                </button>
              );
            })}

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200 mx-1" />

            {/* Category filter pills (mirror stat blocks) */}
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mr-1">Quick:</span>
            {([
              { key: 'unseen' as CategoryFilter, label: 'Unseen', count: unseenCount },
              { key: 'stale' as CategoryFilter, label: 'Stale', count: staleCount },
              { key: 'incomplete' as CategoryFilter, label: 'Incomplete', count: incompleteCount },
            ]).map(f => {
              const active = categoryFilters.has(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => toggleCategory(f.key)}
                  className={`
                    px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border
                    ${active
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-600'
                    }
                  `}
                >
                  {f.label} <span className={active ? 'text-white/70' : 'text-gray-400'}>{f.count}</span>
                </button>
              );
            })}

            {/* Reset all */}
            {(statusFilters.size !== DEFAULT_STATUSES.size ||
              ![...DEFAULT_STATUSES].every(s => statusFilters.has(s)) ||
              categoryFilters.size > 0) && (
              <button
                onClick={() => {
                  setStatusFilters(new Set(DEFAULT_STATUSES));
                  setCategoryFilters(new Set());
                }}
                className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500 text-sm">
            Loading encounters…
          </div>
        ) : filteredEncounters.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500 text-sm">
            No patients found
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── New Arrivals (Unseen) ─────────────────────────────── */}
            {unseen.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                  New Arrivals ({unseen.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unseen.map(encounter => (
                    <EncounterCard
                      key={encounter.id}
                      encounter={encounter}
                      isNew
                      isStale={minutesSince(encounter.createdAt) >= STALE_MINUTES}
                      getInitials={getInitials}
                      formatTime={formatTime}
                      onClick={() => handleSelectEncounter(encounter)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Reviewed (Seen) ───────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Reviewed ({seen.length})
              </h2>
              {seen.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center text-sm text-gray-400">
                  {unseen.length > 0
                    ? 'Open new arrivals above to review them'
                    : 'No patients to display'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {seen.map(encounter => (
                    <EncounterCard
                      key={encounter.id}
                      encounter={encounter}
                      isNew={false}
                      isStale={false}
                      getInitials={getInitials}
                      formatTime={formatTime}
                      onClick={() => handleSelectEncounter(encounter)}
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
          onAdmit={(enc) => {
            onAdmit(enc);
            setSelectedEncounter(null);
          }}
          onSendReminder={async (enc, message) => {
            await sendMessage(enc.id, { content: message });
          }}
        />
      )}
    </div>
  );
}

// ─── Encounter Card ─────────────────────────────────────────────────────────

function EncounterCard({
  encounter,
  isNew,
  isStale,
  getInitials,
  formatTime,
  onClick,
}: {
  encounter: Encounter;
  isNew: boolean;
  isStale: boolean;
  getInitials: (name: string) => string;
  formatTime: (d: string) => string;
  onClick: () => void;
}) {
  const name = patientName(encounter.patient);
  const initials = getInitials(name);
  const completeness = checkFormCompleteness(encounter);

  return (
    <div
      className={`
        rounded-xl border shadow-sm p-5 transition-all cursor-pointer
        ${isNew
          ? isStale
            ? 'bg-red-50 border-red-300 hover:shadow-md ring-1 ring-red-200'
            : 'bg-amber-50 border-amber-300 hover:shadow-md ring-1 ring-amber-200'
          : 'bg-white border-gray-200 hover:shadow-md'
        }
      `}
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center text-sm font-bold shrink-0 ${
          isNew ? 'bg-amber-600' : 'bg-priage-600'
        }`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 truncate">{name}</div>
          <div className="text-xs text-gray-400">#{encounter.id}</div>
        </div>
        {isNew && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
            isStale ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {isStale ? 'STALE' : 'NEW'}
          </span>
        )}
      </div>

      {/* Badges */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        <StatusPill status={encounter.status} />
        {encounter.currentCtasLevel && (
          <CTASBadge level={encounter.currentCtasLevel as 1|2|3|4|5} />
        )}
        {/* Form completeness badge */}
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
          completeness.score >= 80
            ? 'bg-green-100 text-green-700'
            : completeness.score >= 50
              ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700'
        }`}>
          {completeness.score}% complete
        </span>
      </div>

      {/* Complaint */}
      <div className="mb-3">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Chief Complaint</div>
        <div className="text-sm text-gray-700 line-clamp-2">{encounter.chiefComplaint ?? 'No complaint recorded'}</div>
      </div>

      {/* Time + stale indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <svg width="12" height="12" fill="none" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Arrived {formatTime(encounter.createdAt)}
        </div>
        {isStale && (
          <span className="text-[10px] text-red-600 font-medium">
            {Math.round(minutesSince(encounter.createdAt))}m unseen
          </span>
        )}
      </div>
    </div>
  );
}
