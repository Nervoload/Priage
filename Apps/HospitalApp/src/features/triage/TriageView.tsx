// HospitalApp/src/features/triage/TriageView.tsx
// Triage view — shows pending (untriaged) patients. Selecting one opens a
// full-page TriageWorkspace.

import { useState, useMemo } from 'react';
import type { Encounter } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { TriageWorkspace } from './TriageWorkspace';
import { NavBar, type View } from '../../shared/ui/NavBar';
import { CTASBadge } from '../../shared/ui/Badge';

interface TriageViewProps {
  onBack?: () => void;
  onNavigate?: (view: View) => void;
  encounters: Encounter[];
  loading?: boolean;
  onRefresh?: () => void;
  user?: { email: string; role: string } | null;
}

export function TriageView({ onBack, onNavigate, encounters, loading, onRefresh, user }: TriageViewProps) {
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Split into pending (no assessments) and triaged (has assessments)
  const pending = useMemo(
    () => encounters.filter(e => !e.triageAssessments || e.triageAssessments.length === 0),
    [encounters],
  );
  const triaged = useMemo(
    () => encounters.filter(e => e.triageAssessments && e.triageAssessments.length > 0),
    [encounters],
  );

  const handleTriageComplete = () => {
    setActiveEncounter(null);
    onRefresh?.();
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
    <div className="min-h-screen bg-gray-50">
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
              {pending.length} pending · {triaged.length} assessed · {encounters.length} total
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
            <div className="text-gray-500 text-sm">No patients in triage</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── Pending Triage ───────────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Pending Triage ({pending.length})
              </h2>

              {pending.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center text-sm text-gray-400">
                  All patients have been assessed
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map(encounter => {
                    const initials = getInitials(patientName(encounter.patient));
                    return (
                      <div
                        key={encounter.id}
                        onClick={() => setActiveEncounter(encounter)}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4 hover:shadow-md hover:border-priage-300 transition-all cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-full bg-priage-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-gray-900">{patientName(encounter.patient)}</span>
                            <span className="text-xs text-gray-400">#{encounter.id}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                              PENDING
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {encounter.chiefComplaint ?? 'No complaint recorded'}
                          </div>
                        </div>
                        <div className="text-sm text-priage-600 font-semibold shrink-0 flex items-center gap-1">
                          Begin Triage
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Already Triaged ──────────────────────────────────────── */}
            {triaged.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  Assessed ({triaged.length})
                </h2>
                <div className="space-y-3">
                  {triaged.map(encounter => {
                    const initials = getInitials(patientName(encounter.patient));
                    const latestCtas = encounter.currentCtasLevel;
                    return (
                      <div
                        key={encounter.id}
                        onClick={() => setActiveEncounter(encounter)}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer opacity-80 hover:opacity-100"
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-400 text-white flex items-center justify-center text-sm font-bold shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-gray-900">{patientName(encounter.patient)}</span>
                            <span className="text-xs text-gray-400">#{encounter.id}</span>
                            {latestCtas && <CTASBadge level={latestCtas as 1|2|3|4|5} />}
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
                              ASSESSED
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {encounter.chiefComplaint ?? 'No complaint recorded'}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">Review →</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
