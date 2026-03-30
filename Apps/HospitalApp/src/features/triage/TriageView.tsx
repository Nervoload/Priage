// HospitalApp/src/features/triage/TriageView.tsx
// Triage view — shows a single queue of patients currently waiting for triage.
// Selecting one opens the full-page TriageWorkspace.

import { useState, useMemo } from 'react';
import type { EncounterDetail, EncounterListItem } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { TriageWorkspace } from './TriageWorkspace';
import { NavBar, type View } from '../../shared/ui/NavBar';
import { CTASBadge } from '../../shared/ui/Badge';
import { useToast } from '../../shared/ui/ToastContext';
import { getEncounter } from '../../shared/api/encounters';
import { DASHBOARD_PAGE_CLASS } from '../../shared/ui/dashboardTheme';

interface TriageViewProps {
  onBack?: () => void;
  onNavigate?: (view: View) => void;
  encounters: EncounterListItem[];
  loading?: boolean;
  onRefresh?: () => void;
  user?: { email: string; role: string } | null;
}

export function TriageView({ onBack, onNavigate, encounters, loading, onRefresh, user }: TriageViewProps) {
  const { showToast } = useToast();
  const [activeEncounter, setActiveEncounter] = useState<EncounterDetail | null>(null);
  const [openingEncounterId, setOpeningEncounterId] = useState<number | null>(null);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const queue = useMemo(
    () => [...encounters].sort((left, right) => {
      const leftTime = new Date(left.triagedAt ?? left.arrivedAt ?? left.createdAt).getTime();
      const rightTime = new Date(right.triagedAt ?? right.arrivedAt ?? right.createdAt).getTime();
      return leftTime - rightTime;
    }),
    [encounters],
  );

  const handleTriageComplete = () => {
    setActiveEncounter(null);
    onRefresh?.();
  };

  const openEncounter = async (encounterId: number) => {
    setOpeningEncounterId(encounterId);
    try {
      const detail = await getEncounter(encounterId);
      setActiveEncounter(detail);
    } catch {
      showToast('Could not load triage workspace. Please try again.', 'error');
    } finally {
      setOpeningEncounterId((current) => (current === encounterId ? null : current));
    }
  };

  // ─── Full-page workspace when a patient is selected ───────────────────

  if (activeEncounter) {
    return (
      <TriageWorkspace
        encounter={activeEncounter}
        onClose={() => setActiveEncounter(null)}
        onComplete={handleTriageComplete}
      />
    );
  }

  // ─── Patient list ─────────────────────────────────────────────────────

  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <NavBar
        currentView="triage"
        onNavigate={(v) => onNavigate?.(v)}
        onLogout={() => onBack?.()}
        user={user ?? null}
      />

      <div className="mx-auto max-w-[1320px] px-4 py-5 sm:px-5 lg:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between rounded-[28px] border border-white/80 bg-white/78 px-5 py-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.5)] backdrop-blur-sm">
          <div>
            <h1 className="font-hospital-display text-[1.9rem] font-semibold tracking-[-0.03em] text-slate-950">Triage</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {queue.length} patient{queue.length === 1 ? '' : 's'} waiting for triage
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="rounded-[14px] border border-priage-200 bg-priage-50/80 px-4 py-2.5 text-sm font-semibold text-priage-700 shadow-[0_14px_30px_-26px_rgba(30,58,95,0.45)] transition-all hover:border-priage-300 hover:bg-priage-100 hover:text-priage-800 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              ↻ Refresh
            </button>
          )}
        </div>

        {loading ? (
          <div className="rounded-[24px] border border-slate-200/80 bg-white/90 py-14 text-center text-sm font-medium text-slate-500 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.35)]">
            Loading triage patients…
          </div>
        ) : encounters.length === 0 ? (
          <div className="rounded-[24px] border border-slate-200/80 bg-white/92 py-14 text-center shadow-[0_20px_50px_-38px_rgba(15,23,42,0.35)]">
            <div className="mb-2 text-4xl text-slate-400">📋</div>
            <div className="text-sm font-medium text-slate-500">No patients waiting for triage</div>
          </div>
        ) : (
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-hospital-display text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Triage Queue ({queue.length})
            </h2>

            <div className="space-y-3.5">
              {queue.map(encounter => {
                const initials = getInitials(patientName(encounter.patient));
                const latestCtas = encounter.currentCtasLevel;
                return (
                  <div
                    key={encounter.id}
                    onClick={() => void openEncounter(encounter.id)}
                    className="group flex cursor-pointer items-center gap-4 rounded-[22px] border border-slate-200/80 bg-white/92 px-5 py-4 shadow-[0_20px_45px_-36px_rgba(15,23,42,0.38)] transition-all duration-200 hover:-translate-y-0.5 hover:border-priage-300 hover:shadow-[0_24px_52px_-34px_rgba(15,23,42,0.42)]"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-priage-600 text-sm font-bold text-white shadow-[0_14px_30px_-20px_rgba(30,58,95,0.75)]">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-hospital-display text-[1.03rem] font-semibold tracking-[-0.02em] text-slate-900">{patientName(encounter.patient)}</span>
                        <span className="text-xs font-medium text-slate-400">#{encounter.id}</span>
                        {latestCtas && <CTASBadge level={latestCtas as 1|2|3|4|5} />}
                        {encounter.priagePreview?.recommendedCtasLevel != null && (
                          <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                            AI CTAS {encounter.priagePreview.recommendedCtasLevel}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-sm text-slate-500">
                        {encounter.chiefComplaint ?? 'No complaint recorded'}
                      </div>
                      {encounter.priagePreview?.briefing && (
                        <div className="mt-1 truncate text-xs font-medium text-sky-700">
                          {encounter.priagePreview.briefing}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-priage-600 transition-colors group-hover:text-priage-700">
                      {openingEncounterId === encounter.id
                        ? 'Opening…'
                        : latestCtas != null
                          ? 'Continue Triage'
                          : 'Open Triage'}
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
