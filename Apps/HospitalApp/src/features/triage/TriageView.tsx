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

      <div className="mx-auto max-w-7xl px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between rounded-[10px] border border-[#e2e8f0] bg-white px-5 py-5">
          <div>
            <h1 className="text-[1.9rem] font-semibold tracking-[-0.03em] text-slate-900">Triage</h1>
            <p className="mt-1 text-sm text-slate-500">
              {queue.length} patient{queue.length === 1 ? '' : 's'} waiting for triage
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="cursor-pointer rounded-[8px] border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ↻ Refresh
            </button>
          )}
        </div>

        {loading ? (
          <div className="rounded-[10px] border border-[#e2e8f0] bg-white py-14 text-center text-sm text-slate-500">
            Loading triage patients…
          </div>
        ) : encounters.length === 0 ? (
          <div className="rounded-[10px] border border-[#e2e8f0] bg-white py-14 text-center">
            <div className="mb-2 text-4xl text-slate-400">📋</div>
            <div className="text-sm font-medium text-slate-500">No patients waiting for triage</div>
          </div>
        ) : (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
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
                    className="group flex cursor-pointer items-center gap-4 rounded-[10px] border border-[#e2e8f0] bg-white px-5 py-4 transition-colors hover:border-[#cbd5e1]"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] bg-slate-900 font-mono text-sm font-bold text-white">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-[1.03rem] font-semibold tracking-[-0.02em] text-slate-900">{patientName(encounter.patient)}</span>
                        <span className="font-mono text-xs text-slate-400">#{encounter.id}</span>
                        {latestCtas && <CTASBadge level={latestCtas as 1|2|3|4|5} />}
                        {encounter.priagePreview?.recommendedCtasLevel != null && (
                          <span className="rounded-[4px] border border-violet-200 bg-violet-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-violet-700">
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
                    <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-slate-600 transition-colors group-hover:text-slate-900">
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
