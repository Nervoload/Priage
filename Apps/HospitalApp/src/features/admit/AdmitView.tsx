// HospitalApp/src/features/admit/AdmitView.tsx
// Admittance dashboard view — Tailwind-styled with NavBar.

import { useState, useMemo } from 'react';
import { TriagePopup } from './TriagePopup';
import type { Encounter } from '../../app/HospitalApp';
import { patientName } from '../../app/HospitalApp';
import { NavBar, type View } from '../../shared/ui/NavBar';
import { CTASBadge } from '../../shared/ui/Badge';
import { StatusPill } from '../../shared/ui/StatusPill';

interface AdmitViewProps {
  onBack?: () => void;
  onNavigate?: (view: View) => void;
  encounters: Encounter[];
  onAdmit: (encounter: Encounter) => void | Promise<void>;
  loading?: boolean;
  onRefresh?: () => void;
  user?: { email: string; role: string } | null;
}

export function AdmitView({ onBack, onNavigate, encounters, onAdmit, loading, onRefresh, user }: AdmitViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All Stages');
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);

  const filteredEncounters = useMemo(() => {
    let filtered = encounters;
    if (statusFilter !== 'All Stages') {
      const statusMap: Record<string, Encounter['status']> = {
        'Expected': 'EXPECTED',
        'Admittance': 'ADMITTED',
        'In Triage': 'TRIAGE',
        'Waiting': 'WAITING',
      };
      const status = statusMap[statusFilter];
      if (status) filtered = filtered.filter(e => e.status === status);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        patientName(e.patient).toLowerCase().includes(q) ||
        (e.chiefComplaint ?? '').toLowerCase().includes(q) ||
        String(e.id).includes(searchQuery)
      );
    }
    return filtered;
  }, [searchQuery, statusFilter, encounters]);

  const getPriority = (encounter: Encounter): { label: string; classes: string } => {
    const complaint = (encounter.chiefComplaint ?? '').toLowerCase();
    if (complaint.includes('critical') || complaint.includes('chest pain') ||
        complaint.includes('difficulty breathing') || complaint.includes('shortness of breath'))
      return { label: 'CRITICAL', classes: 'bg-red-100 text-red-700' };
    if (complaint.includes('severe') || complaint.includes('high fever') || complaint.includes('high'))
      return { label: 'HIGH', classes: 'bg-orange-100 text-orange-700' };
    return { label: 'MEDIUM', classes: 'bg-amber-100 text-amber-700' };
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Summary stats
  const expecting = encounters.filter(e => e.status === 'EXPECTED').length;
  const inAdmittance = encounters.filter(e => e.status === 'ADMITTED').length;
  const totalActive = encounters.filter(e => e.status !== 'COMPLETE' && e.status !== 'CANCELLED').length;
  const waitingPatients = encounters.filter(e => e.status === 'WAITING');
  const avgWaitTime = waitingPatients.length > 0
    ? Math.round(waitingPatients.reduce((acc, e) => acc + (Date.now() - new Date(e.createdAt).getTime()), 0) / waitingPatients.length / 60000)
    : 0;

  const stats = [
    { label: 'Expecting', value: expecting },
    { label: 'In Admittance', value: inAdmittance },
    { label: 'Total Active', value: totalActive },
    { label: 'Avg Wait Time', value: `${avgWaitTime}m` },
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
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 mb-6">
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-priage-300 min-w-[140px]"
          >
            <option>All Stages</option>
            <option>Expected</option>
            <option>Admittance</option>
            <option>In Triage</option>
            <option>Waiting</option>
          </select>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              title="Refresh encounters"
              className="px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              ↻
            </button>
          )}
        </div>

        {/* Patient Cards */}
        {loading ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500 text-sm">
            Loading encounters…
          </div>
        ) : filteredEncounters.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-500 text-sm">
            No patients found
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEncounters.map(encounter => {
              const priority = getPriority(encounter);
              const initials = getInitials(patientName(encounter.patient));
              return (
                <div
                  key={encounter.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedEncounter(encounter)}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-priage-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 truncate">{patientName(encounter.patient)}</div>
                      <div className="text-xs text-gray-400">#{encounter.id}</div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    <StatusPill status={encounter.status} />
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${priority.classes}`}>
                      {priority.label}
                    </span>
                    {encounter.currentCtasLevel && (
                      <CTASBadge level={encounter.currentCtasLevel as 1|2|3|4|5} />
                    )}
                  </div>

                  {/* Complaint */}
                  <div className="mb-3">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Chief Complaint</div>
                    <div className="text-sm text-gray-700 line-clamp-2">{encounter.chiefComplaint ?? 'No complaint recorded'}</div>
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <svg width="12" height="12" fill="none" viewBox="0 0 16 16">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Arrived {formatTime(encounter.createdAt)}
                  </div>
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
          onAdmit={(enc) => {
            onAdmit(enc);
            setSelectedEncounter(null);
          }}
        />
      )}
    </div>
  );
}
