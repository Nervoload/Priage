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

      <div className="p-6 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Triage</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {queue.length} patient{queue.length === 1 ? '' : 's'} waiting for triage
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
            >
              ↻ Refresh
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500 text-sm">
            Loading triage patients…
          </div>
        ) : encounters.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="text-gray-400 text-4xl mb-2">📋</div>
            <div className="text-gray-500 text-sm">No patients waiting for triage</div>
          </div>
        ) : (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Triage Queue ({queue.length})
            </h2>

            <div className="space-y-3">
              {queue.map(encounter => {
                const initials = getInitials(patientName(encounter.patient));
                const latestCtas = encounter.currentCtasLevel;
                return (
                  <div
                    key={encounter.id}
                    onClick={() => void openEncounter(encounter.id)}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4 hover:shadow-md hover:border-priage-300 transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-priage-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-gray-900">{patientName(encounter.patient)}</span>
                        <span className="text-xs text-gray-400">#{encounter.id}</span>
                        {latestCtas && <CTASBadge level={latestCtas as 1|2|3|4|5} />}
                        {encounter.priagePreview?.recommendedCtasLevel != null && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-700">
                            AI CTAS {encounter.priagePreview.recommendedCtasLevel}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {encounter.chiefComplaint ?? 'No complaint recorded'}
                      </div>
                      {encounter.priagePreview?.briefing && (
                        <div className="mt-1 text-xs text-sky-700 truncate">
                          {encounter.priagePreview.briefing}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-priage-600 font-semibold shrink-0 flex items-center gap-1">
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
