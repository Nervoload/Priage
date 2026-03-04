// HospitalApp/src/features/triage/TriageView.tsx
// Triage view — Tailwind-styled with NavBar.

import { useState } from 'react';
import type { Encounter } from '../../app/HospitalApp';
import { patientName } from '../../app/HospitalApp';
import { TriagePopup } from '../admit/TriagePopup';
import { moveToWaiting } from '../../shared/api/encounters';
import { useToast } from '../../shared/ui/ToastContext';
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
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const { showToast } = useToast();

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getPriorityClasses = (encounter: Encounter): { label: string; classes: string } => {
    const ctas = encounter.currentCtasLevel;
    if (ctas === 1) return { label: 'CRITICAL', classes: 'bg-red-100 text-red-700' };
    if (ctas === 2) return { label: 'HIGH', classes: 'bg-orange-100 text-orange-700' };
    if (ctas === 3) return { label: 'MEDIUM', classes: 'bg-amber-100 text-amber-700' };
    if (ctas === 4) return { label: 'LOW', classes: 'bg-blue-100 text-blue-700' };
    if (ctas === 5) return { label: 'LOW', classes: 'bg-gray-100 text-gray-600' };
    return { label: 'UNASSESSED', classes: 'bg-gray-100 text-gray-500' };
  };

  const handleMoveToWaiting = async (encounter: Encounter) => {
    try {
      await moveToWaiting(encounter.id);
      showToast(`${encounter.patient.firstName ?? 'Patient'} moved to waiting`, 'success');
      setSelectedEncounter(null);
      onRefresh?.();
    } catch (err) {
      console.error('[TriageView] Failed to move to waiting:', err);
      showToast('Failed to move patient to waiting. Please try again.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        currentView="triage"
        onNavigate={(v) => onNavigate?.(v)}
        onLogout={() => onBack?.()}
        user={user ?? null}
      />

      <div className="p-6 max-w-[1200px] mx-auto">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Triage Patients</h1>
            <p className="text-sm text-gray-500 mt-0.5">{encounters.length} patient{encounters.length !== 1 ? 's' : ''} in triage</p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              ↻ Refresh
            </button>
          )}
        </div>

        {/* Patient list */}
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
          <div className="space-y-3">
            {encounters.map(encounter => {
              const priority = getPriorityClasses(encounter);
              const initials = getInitials(patientName(encounter.patient));
              return (
                <div
                  key={encounter.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-priage-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-gray-900">{patientName(encounter.patient)}</span>
                      <span className="text-xs text-gray-400">#{encounter.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${priority.classes}`}>
                        {priority.label}
                      </span>
                      {encounter.currentCtasLevel && (
                        <CTASBadge level={encounter.currentCtasLevel as 1|2|3|4|5} />
                      )}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {encounter.chiefComplaint ?? 'No complaint recorded'}
                    </div>
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => setSelectedEncounter(encounter)}
                    className="px-4 py-2 bg-priage-600 text-white rounded-lg text-sm font-semibold hover:bg-priage-700 transition-colors shrink-0"
                  >
                    Get Details
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedEncounter && (
        <TriagePopup
          encounter={selectedEncounter}
          onClose={() => setSelectedEncounter(null)}
          onAdmit={handleMoveToWaiting}
        />
      )}
    </div>
  );
}
