// HospitalApp/src/features/waitingroom/WaitingRoomView.tsx
// Waiting Room — grid dashboard of patient cells.
// AlertDashboard renders as a fixed right-side panel (VS Code chat style).

import { useState, useMemo, useEffect, useRef } from 'react';
import type { Encounter, ChatMessage, AlertSeverity } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { NavBar, type View } from '../../shared/ui/NavBar';
import { PatientCard } from './PatientCard';
import { PatientDetailModal } from './PatientDetailModal';
import { AlertDashboard } from './AlertDashboard';

interface WaitingRoomViewProps {
  onBack?: () => void;
  onNavigate?: (view: View) => void;
  encounters: Encounter[];
  chatMessages: Record<number, ChatMessage[]>;
  onSendMessage: (encounterId: number, text: string) => Promise<void>;
  onRemovePatient: (encounterId: number) => Promise<void>;
  loading?: boolean;
  onRefresh?: () => void;
  user?: { email: string; role: string } | null;
}

type FilterKey = 'all' | 'ctas12' | 'ctas3' | 'ctas45' | 'alerts';

export function WaitingRoomView({
  onBack,
  onNavigate,
  encounters,
  chatMessages,
  onSendMessage,
  onRemovePatient,
  loading,
  onRefresh,
  user,
}: WaitingRoomViewProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  // Track "seen" patient message counts at mount for unread detection
  const seenMsgCounts = useRef<Record<number, number>>({});
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const baseline: Record<number, number> = {};
    for (const enc of encounters) {
      const msgs = chatMessages[enc.id] || [];
      baseline[enc.id] = msgs.filter(m => m.sender === 'patient').length;
    }
    seenMsgCounts.current = baseline;
  }, []); // mount-only baseline

  // Auto-refresh counters
  useEffect(() => {
    const timer = setInterval(() => forceUpdate(n => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Derive alert severities per encounter (simple wait-time based)
  const alertMap = useMemo(() => {
    const map: Record<number, AlertSeverity> = {};
    for (const enc of encounters) {
      const waitStart = enc.waitingAt ?? enc.triagedAt ?? enc.arrivedAt ?? enc.createdAt;
      if (!waitStart) continue;
      const mins = (Date.now() - new Date(waitStart).getTime()) / 60_000;
      if (enc.currentCtasLevel === 1 && mins >= 10) {
        map[enc.id] = 'CRITICAL';
      } else if (mins >= 60) {
        map[enc.id] = 'CRITICAL';
      } else if (mins >= 30) {
        map[enc.id] = 'HIGH';
      } else if (enc.currentCtasLevel != null && enc.currentCtasLevel <= 2 && mins >= 15) {
        map[enc.id] = 'HIGH';
      }
    }
    return map;
  }, [encounters]);

  const getUnreadCount = (encId: number) => {
    const currentPatientMsgs = (chatMessages[encId] || []).filter(m => m.sender === 'patient').length;
    const baseline = seenMsgCounts.current[encId] ?? 0;
    return Math.max(0, currentPatientMsgs - baseline);
  };

  // Filter + sort encounters
  const displayEncounters = useMemo(() => {
    let list = encounters;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((enc) => {
        const name = patientName(enc.patient).toLowerCase();
        const id = String(enc.id);
        const complaint = (enc.chiefComplaint ?? '').toLowerCase();
        return name.includes(q) || id.includes(q) || complaint.includes(q);
      });
    }

    // Filter pills
    switch (filter) {
      case 'ctas12':
        list = list.filter((e) => e.currentCtasLevel != null && e.currentCtasLevel <= 2);
        break;
      case 'ctas3':
        list = list.filter((e) => e.currentCtasLevel === 3);
        break;
      case 'ctas45':
        list = list.filter((e) => e.currentCtasLevel != null && e.currentCtasLevel >= 4);
        break;
      case 'alerts':
        list = list.filter((e) => alertMap[e.id] != null);
        break;
    }

    // Sort: alerts first (CRITICAL > HIGH), then CTAS (1 first), then by wait time (longest first)
    const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    list = [...list].sort((a, b) => {
      const aAlert = alertMap[a.id] ? severityOrder[alertMap[a.id]] ?? 4 : 4;
      const bAlert = alertMap[b.id] ? severityOrder[alertMap[b.id]] ?? 4 : 4;
      if (aAlert !== bAlert) return aAlert - bAlert;

      const aCtas = a.currentCtasLevel ?? 99;
      const bCtas = b.currentCtasLevel ?? 99;
      if (aCtas !== bCtas) return aCtas - bCtas;

      const aWait = new Date(a.waitingAt ?? a.triagedAt ?? a.arrivedAt ?? a.createdAt).getTime();
      const bWait = new Date(b.waitingAt ?? b.triagedAt ?? b.arrivedAt ?? b.createdAt).getTime();
      return aWait - bWait; // oldest first
    });

    return list;
  }, [encounters, searchQuery, filter, alertMap]);

  const selectedEncounter = encounters.find((e) => e.id === selectedId) ?? null;
  const alertCount = Object.keys(alertMap).length;

  const filters: { key: FilterKey; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: encounters.length },
    { key: 'ctas12', label: 'CTAS 1–2', count: encounters.filter((e) => e.currentCtasLevel != null && e.currentCtasLevel <= 2).length },
    { key: 'ctas3', label: 'CTAS 3', count: encounters.filter((e) => e.currentCtasLevel === 3).length },
    { key: 'ctas45', label: 'CTAS 4–5', count: encounters.filter((e) => e.currentCtasLevel != null && e.currentCtasLevel >= 4).length },
    { key: 'alerts', label: 'Has Alerts', count: alertCount },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NavBar */}
      <NavBar
        currentView="waiting"
        onNavigate={(v) => onNavigate?.(v as any)}
        onLogout={() => onBack?.()}
        user={user ?? null}
      />

      <div className="p-6 max-w-[1600px] mx-auto space-y-4">
        {/* Toolbar: Search + Filters + Refresh */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <svg
                width="14" height="14" viewBox="0 0 16 16" fill="none"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patients..."
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-priage-300 focus:border-priage-400 w-64 transition-shadow"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer
                    ${filter === f.key
                      ? 'bg-priage-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-priage-300 hover:text-priage-600'
                    }
                  `}
                >
                  {f.label}
                  {f.count != null && f.count > 0 && (
                    <span className={`ml-1.5 ${filter === f.key ? 'text-priage-200' : 'text-gray-400'}`}>
                      {f.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <span className={loading ? 'animate-spin' : ''}>↻</span>
              Refresh
            </button>
          )}
        </div>

        {/* Grid or empty state */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-44 animate-shimmer" />
            ))}
          </div>
        ) : displayEncounters.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            {searchQuery || filter !== 'all' ? (
              <>
                <div className="text-4xl mb-3">🔍</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-1">No patients match</h3>
                <p className="text-sm text-gray-500">
                  Try adjusting your search or filters.
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setFilter('all'); }}
                  className="mt-3 text-sm text-priage-600 hover:text-priage-700 font-medium cursor-pointer"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">🏥</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-1">No patients in waiting room</h3>
                <p className="text-sm text-gray-500">
                  Patients will appear here once admitted and triaged.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayEncounters.map((encounter) => (
              <PatientCard
                key={encounter.id}
                encounter={encounter}
                messages={chatMessages[encounter.id] || []}
                unreadCount={getUnreadCount(encounter.id)}
                alertSeverity={alertMap[encounter.id] ?? null}
                onClick={() => setSelectedId(encounter.id)}
              />
            ))}
          </div>
        )}

        {/* Patient count footer */}
        {displayEncounters.length > 0 && (
          <div className="text-center text-xs text-gray-400 pt-2">
            Showing {displayEncounters.length} of {encounters.length} patients
          </div>
        )}
      </div>

      {/* Patient Detail Modal */}
      <PatientDetailModal
        encounter={selectedEncounter}
        messages={selectedEncounter ? (chatMessages[selectedEncounter.id] || []) : []}
        onSendMessage={onSendMessage}
        onRemovePatient={onRemovePatient}
        onClose={() => setSelectedId(null)}
      />

      {/* Right-side alerts & analytics panel (fixed position) */}
      <AlertDashboard
        encounters={encounters}
        chatMessages={chatMessages}
        onSelectPatient={(id) => setSelectedId(id)}
      />
    </div>
  );
}
