// HospitalApp/src/features/waitingroom/WaitingRoomView.tsx
// Waiting Room dashboard aligned with the admittance visual system while
// preserving queue, alert, and messaging workflows.

import { useEffect, useMemo, useState } from 'react';
import type { Encounter, ChatMessage, AlertSeverity } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { NavBar, type View } from '../../shared/ui/NavBar';
import {
  DASHBOARD_EMPTY_STATE_CLASS,
  DASHBOARD_GLASS_PANEL_CLASS,
  DASHBOARD_PAGE_CLASS,
} from '../../shared/ui/dashboardTheme';
import { PatientCard } from './PatientCard';
import { PatientDetailModal } from './PatientDetailModal';
import { AlertDashboard } from './AlertDashboard';
import { sortByQueuePriority, getQueuePositions } from '../../shared/queue/queuePriority';

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

const FILTER_THEME: Record<FilterKey, { summary: string; pill: string }> = {
  all: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    pill: 'border-slate-900 bg-slate-900 text-white',
  },
  ctas12: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    pill: 'border-slate-900 bg-slate-900 text-white',
  },
  ctas3: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    pill: 'border-slate-900 bg-slate-900 text-white',
  },
  ctas45: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    pill: 'border-slate-900 bg-slate-900 text-white',
  },
  alerts: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    pill: 'border-slate-900 bg-slate-900 text-white',
  },
};

const WAITING_ROOM_CARD_GRID_CLASS =
  'grid w-full grid-cols-1 gap-3 justify-items-start sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

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
  const [filtersVisible, setFiltersVisible] = useState(true);

  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => forceUpdate((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const alertMap = useMemo(() => {
    const map: Record<number, AlertSeverity> = {};
    for (const encounter of encounters) {
      const waitStart = encounter.waitingAt ?? encounter.triagedAt ?? encounter.arrivedAt ?? encounter.createdAt;
      if (!waitStart) continue;
      const minutes = (Date.now() - new Date(waitStart).getTime()) / 60_000;

      if (encounter.currentCtasLevel === 1 && minutes >= 10) {
        map[encounter.id] = 'CRITICAL';
      } else if (minutes >= 60) {
        map[encounter.id] = 'CRITICAL';
      } else if (minutes >= 30) {
        map[encounter.id] = 'HIGH';
      } else if (encounter.currentCtasLevel != null && encounter.currentCtasLevel <= 2 && minutes >= 15) {
        map[encounter.id] = 'HIGH';
      }
    }
    return map;
  }, [encounters]);

  const queueMap = useMemo(() => getQueuePositions(encounters), [encounters]);

  const displayEncounters = useMemo(() => {
    let list = encounters;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter((encounter) => {
        const name = patientName(encounter.patient).toLowerCase();
        const complaint = (encounter.chiefComplaint ?? '').toLowerCase();
        return name.includes(query) || complaint.includes(query) || String(encounter.id).includes(searchQuery);
      });
    }

    switch (filter) {
      case 'ctas12':
        list = list.filter((encounter) => encounter.currentCtasLevel != null && encounter.currentCtasLevel <= 2);
        break;
      case 'ctas3':
        list = list.filter((encounter) => encounter.currentCtasLevel === 3);
        break;
      case 'ctas45':
        list = list.filter((encounter) => encounter.currentCtasLevel != null && encounter.currentCtasLevel >= 4);
        break;
      case 'alerts':
        list = list.filter((encounter) => alertMap[encounter.id] != null);
        break;
      case 'all':
        break;
    }

    return sortByQueuePriority(list).map((entry) => entry.encounter);
  }, [alertMap, encounters, filter, searchQuery]);

  const selectedEncounter = encounters.find((encounter) => encounter.id === selectedId) ?? null;
  const alertCount = Object.keys(alertMap).length;
  const hasCustomFilters = filter !== 'all' || searchQuery.trim().length > 0;

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: encounters.length },
    { key: 'ctas12', label: 'CTAS 1–2', count: encounters.filter((encounter) => encounter.currentCtasLevel != null && encounter.currentCtasLevel <= 2).length },
    { key: 'ctas3', label: 'CTAS 3', count: encounters.filter((encounter) => encounter.currentCtasLevel === 3).length },
    { key: 'ctas45', label: 'CTAS 4–5', count: encounters.filter((encounter) => encounter.currentCtasLevel != null && encounter.currentCtasLevel >= 4).length },
    { key: 'alerts', label: 'Alerts', count: alertCount },
  ];

  const toggleFilter = (key: FilterKey) => {
    setFilter((current) => (current === key ? 'all' : key));
  };

  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <NavBar
        currentView="waiting"
        onNavigate={(view) => onNavigate?.(view)}
        onLogout={() => onBack?.()}
        user={user ?? null}
      />

      <div className="mx-auto max-w-7xl px-8 py-6">
        <div className={`${DASHBOARD_GLASS_PANEL_CLASS} transition-all duration-300 ${filtersVisible ? 'mb-7 p-4 sm:p-5' : 'mb-5 p-4'}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className={`relative flex-1 transition-all duration-300 ${filtersVisible ? 'translate-y-0' : '-translate-y-0.5'}`}>
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
                  h-[44px] w-full rounded-[8px] border border-[#e2e8f0] bg-white px-4 py-3 pl-11
                  text-sm text-slate-700 placeholder:text-slate-300
                  focus:border-[#3b82f6] focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]
                "
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600 cursor-pointer"
                  aria-label="Clear search"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                title="Refresh waiting room"
                className="
                  rounded-[8px] border border-[#e2e8f0] bg-white px-4 py-3 text-sm font-semibold text-slate-600
                  transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                Refresh
              </button>
            )}

            {hasCustomFilters && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilter('all');
                }}
                className="
                  rounded-[8px] border border-[#e2e8f0] bg-white px-4 py-3 text-sm font-semibold text-slate-600
                  transition hover:bg-slate-50
                "
              >
                Reset
              </button>
            )}

            <button
              onClick={() => setFiltersVisible((value) => !value)}
              className="
                rounded-[8px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white
                transition hover:bg-slate-700
              "
            >
              {filtersVisible ? 'Hide filters' : 'Show filters'}
            </button>
          </div>

          <div
            className={`
              transition-[max-height,margin,padding] duration-300 ease-out
              ${filtersVisible ? 'mt-4 max-h-[560px] overflow-visible px-1 pt-2 pb-1' : 'mt-0 max-h-0 overflow-hidden px-0 pt-0 pb-0'}
            `}
          >
            <div
              className={`
                transition-[opacity,transform] duration-200 ease-out
                ${filtersVisible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}
              `}
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {filters.map((filterOption) => {
                  const isActive = filter === filterOption.key;
                  const activeClasses = FILTER_THEME[filterOption.key].summary;
                  return (
                    <div
                      key={filterOption.key}
                      onClick={() => toggleFilter(filterOption.key)}
                      className={`
                        cursor-pointer rounded-[8px] border px-4 py-4 transition-colors hover:border-[#cbd5e1]
                        ${isActive
                          ? activeClasses
                          : 'border-[#e2e8f0] bg-white text-slate-900 hover:border-[#cbd5e1]'
                        }
                      `}
                    >
                      <div className={`font-mono text-[12px] font-semibold uppercase tracking-[0.16em] ${isActive ? 'text-white/78' : 'text-slate-600'}`}>
                        {filterOption.label}
                      </div>
                      <div className={`mt-2 text-[2.15rem] font-semibold tracking-[-0.03em] ${isActive ? 'text-white' : 'text-slate-900'}`}>
                        {filterOption.count}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[10px] border border-[#e2e8f0] bg-slate-50 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Focus</span>
                  {filters.map((filterOption) => {
                    const isActive = filter === filterOption.key;
                    const buttonClasses = isActive
                      ? FILTER_THEME[filterOption.key].pill
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900';

                    return (
                      <button
                        key={filterOption.key}
                        onClick={() => toggleFilter(filterOption.key)}
                        className={`
                          inline-flex items-center gap-2 rounded-[6px] border px-3.5 py-2 text-[13px] font-semibold transition
                          ${buttonClasses}
                        `}
                      >
                        <span>{filterOption.label}</span>
                        <span className={isActive ? 'text-white/78' : 'text-slate-500'}>{filterOption.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className={WAITING_ROOM_CARD_GRID_CLASS}>
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-36 max-w-sm rounded-[10px] border border-[#e2e8f0] bg-white p-4 animate-shimmer"
              />
            ))}
          </div>
        ) : displayEncounters.length === 0 ? (
          <div className={DASHBOARD_EMPTY_STATE_CLASS}>
            {searchQuery || filter !== 'all' ? (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-slate-100 text-slate-500">
                  <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                    <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
                    <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="mb-1 text-lg font-semibold text-slate-700">No patients match</h3>
                <p className="text-sm text-slate-500">Try adjusting your search or focus filters.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilter('all');
                  }}
                  className="mt-3 text-sm font-medium text-priage-600 transition-colors hover:text-priage-700 cursor-pointer"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-slate-100 text-slate-500">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 20V7.5A1.5 1.5 0 0 1 6.5 6H10V3.5A1.5 1.5 0 0 1 11.5 2h1A1.5 1.5 0 0 1 14 3.5V6h3.5A1.5 1.5 0 0 1 19 7.5V20"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M9 11h6M12 8v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M3 20h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="mb-1 text-lg font-semibold text-slate-700">No patients in waiting room</h3>
                <p className="text-sm text-slate-500">Patients will appear here once admitted and triaged.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className={WAITING_ROOM_CARD_GRID_CLASS}>
              {displayEncounters.map((encounter) => (
                <PatientCard
                  key={encounter.id}
                  encounter={encounter}
                  messages={chatMessages[encounter.id] || []}
                  alertSeverity={alertMap[encounter.id] ?? null}
                  queueEntry={queueMap.get(encounter.id) ?? null}
                  onClick={() => setSelectedId(encounter.id)}
                />
              ))}
            </div>

            <div className="pt-1 text-center text-xs font-medium text-slate-400">
              Showing {displayEncounters.length} of {encounters.length} patients
            </div>
          </div>
        )}
      </div>

      <PatientDetailModal
        encounter={selectedEncounter}
        messages={selectedEncounter ? (chatMessages[selectedEncounter.id] || []) : []}
        onSendMessage={onSendMessage}
        onRemovePatient={onRemovePatient}
        onClose={() => setSelectedId(null)}
      />

      <AlertDashboard
        encounters={encounters}
        chatMessages={chatMessages}
        onSelectPatient={(id) => setSelectedId(id)}
      />
    </div>
  );
}
