// HospitalApp/src/features/waitingroom/AlertDashboard.tsx
// Right-side expandable alerts & analytics panel for the waiting room.
// Slides out from the right edge, like a chat/panel in VS Code.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Encounter, ChatMessage } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';

interface AlertDashboardProps {
  encounters: Encounter[];
  chatMessages: Record<number, ChatMessage[]>;
  onSelectPatient?: (encounterId: number) => void;
}

// NavBar height (h-14 = 56px)
const NAV_HEIGHT = 56;
const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 700;
const DEFAULT_PANEL_WIDTH = 380;

// ─── Helpers ────────────────────────────────────────────────────────────────

function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

function waitingSince(enc: Encounter): string | null {
  if (enc.status === 'WAITING' && enc.waitingAt) return enc.waitingAt;
  if (enc.status === 'TRIAGE' && enc.triagedAt) return enc.triagedAt;
  return enc.arrivedAt ?? enc.createdAt;
}

type Severity = 'ok' | 'warn' | 'critical';

function waitSeverity(mins: number): Severity {
  if (mins >= 45) return 'critical';
  if (mins >= 15) return 'warn';
  return 'ok';
}

const SEV = {
  ok:       { bg: 'bg-green-50',  border: 'border-green-200', dot: 'bg-green-500', text: 'text-green-800' },
  warn:     { bg: 'bg-amber-50',  border: 'border-amber-200', dot: 'bg-amber-500', text: 'text-amber-800' },
  critical: { bg: 'bg-red-50',    border: 'border-red-200',   dot: 'bg-red-500',   text: 'text-red-800'   },
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

export function AlertDashboard({ encounters, chatMessages, onSelectPatient }: AlertDashboardProps) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'alerts' | 'summary'>('alerts');
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [expanded, setExpanded] = useState(false);

  // Drag-resize state
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_PANEL_WIDTH);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - ev.clientX; // dragging left = bigger
      const next = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, dragStartWidth.current + delta));
      setPanelWidth(next);
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  // Baseline message counts for unread detection
  const seenMsgCounts = useRef<Record<number, number>>({});
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const baseline: Record<number, number> = {};
    for (const enc of encounters) {
      const msgs = chatMessages[enc.id] || [];
      baseline[enc.id] = msgs.filter(m => m.sender === 'patient').length;
    }
    seenMsgCounts.current = baseline;
  }, []); // mount-only

  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const dismiss = useCallback((encId: number) => {
    setDismissed(prev => new Set(prev).add(encId));
  }, []);

  // Build alert items
  const items = encounters
    .filter(enc => !dismissed.has(enc.id))
    .map(enc => {
      const since = waitingSince(enc);
      const mins = minutesSince(since);
      const severity = waitSeverity(mins);
      const name = patientName(enc.patient);
      const currentPatientMsgs = (chatMessages[enc.id] || []).filter(m => m.sender === 'patient').length;
      const baselineCount = seenMsgCounts.current[enc.id] ?? 0;
      const newMsgCount = Math.max(0, currentPatientMsgs - baselineCount);
      return { enc, mins, severity, name, newMsgCount };
    });

  const order: Record<Severity, number> = { critical: 0, warn: 1, ok: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);

  const critCount = items.filter(i => i.severity === 'critical').length;
  const warnCount = items.filter(i => i.severity === 'warn').length;
  const msgCount = items.reduce((s, i) => s + i.newMsgCount, 0);
  const totalAlerts = critCount + warnCount;

  // Summary stats
  const avgWaitMins = encounters.length > 0
    ? Math.round(encounters.reduce((s, e) => s + minutesSince(waitingSince(e)), 0) / encounters.length)
    : 0;
  const ctasBreakdown = [1, 2, 3, 4, 5].map(level => ({
    level,
    count: encounters.filter(e => e.currentCtasLevel === level).length,
  })).filter(c => c.count > 0);
  const statusBreakdown = ['TRIAGE', 'WAITING', 'COMPLETE'].map(s => ({
    status: s,
    count: encounters.filter(e => e.status === s).length,
  })).filter(c => c.count > 0);

  return (
    <>
      {/* ── Toggle tab (right edge, always visible, below navbar) ──── */}
      <button
        onClick={() => setOpen(!open)}
        className={`
          fixed right-0 z-40 cursor-pointer
          flex items-center gap-1.5 px-2 py-3
          rounded-l-lg border border-r-0 shadow-lg transition-all
          ${totalAlerts > 0
            ? 'bg-red-600 text-white border-red-700 hover:bg-red-700'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }
        `}
        style={{
          top: `calc(50% + ${NAV_HEIGHT / 2}px)`,
          transform: 'translateY(-50%)',
          writingMode: 'vertical-lr',
          textOrientation: 'mixed',
        }}
        title={open ? 'Close panel' : 'Open alerts panel'}
      >
        <span className="text-xs font-bold tracking-wide" style={{ writingMode: 'vertical-lr' }}>
          {open ? '✕' : totalAlerts > 0 ? `${totalAlerts}` : ''}
        </span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="rotate-0">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {msgCount > 0 && !open && (
          <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
            {msgCount}
          </span>
        )}
      </button>

      {/* ── Slide-out panel (below navbar, resizable) ────────────── */}
      <div
        className={`
          fixed right-0 z-30 transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{
          top: NAV_HEIGHT,
          height: `calc(100vh - ${NAV_HEIGHT}px)`,
          width: expanded ? '100vw' : panelWidth,
          transition: expanded ? 'width 0.3s ease-in-out' : undefined,
        }}
      >
        <div className="h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col relative">
          {/* Drag handle (left edge) with arrow indicator — hidden when expanded */}
          {!expanded && (
          <div
            onMouseDown={onDragStart}
            className="absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize z-10 group flex items-center justify-center hover:bg-priage-200/50 active:bg-priage-400/50 transition-colors"
            title="Drag to resize"
          >
            <svg width="6" height="24" viewBox="0 0 6 24" fill="none" className="opacity-30 group-hover:opacity-70 transition-opacity">
              <path d="M3 2L0.5 5H5.5L3 2Z" fill="currentColor" />
              <path d="M3 22L0.5 19H5.5L3 22Z" fill="currentColor" />
              <line x1="1.5" y1="8" x2="1.5" y2="16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="4.5" y1="8" x2="4.5" y2="16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>
          )}
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-900">Waiting Room Panel</h2>
              <div className="flex items-center gap-1">
                {/* Expand / collapse full-screen */}
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                  title={expanded ? 'Collapse to side panel' : 'Expand to full view'}
                >
                  {expanded ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M10 2v4h4M6 14v-4H2M10 6L14 2M6 10l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M14 2l-4 4M2 14l4-4M10 2h4v4M6 14H2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {/* Close */}
                <button
                  onClick={() => { setOpen(false); setExpanded(false); }}
                  className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Summary badges */}
            <div className="flex gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                {encounters.length} patients
              </span>
              {critCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                  {critCount} critical
                </span>
              )}
              {warnCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                  {warnCount} warning
                </span>
              )}
              {msgCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                  {msgCount} new messages
                </span>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-3">
              {(['alerts', 'summary'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer
                    ${activeTab === tab
                      ? 'bg-priage-600 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                    }
                  `}
                >
                  {tab === 'alerts' ? `Alerts (${totalAlerts})` : 'Summary'}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'alerts' ? (
              /* ── Alerts tab ───────────────────────────────────────── */
              items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <span className="text-3xl mb-2">✓</span>
                  <p className="text-sm">All clear — no active alerts</p>
                </div>
              ) : (
                <div>
                  {items.map(({ enc, mins, severity, name, newMsgCount }) => {
                    const s = SEV[severity];
                    return (
                      <div
                        key={enc.id}
                        className={`
                          flex items-start gap-3 px-4 py-3 border-b cursor-pointer
                          transition-colors hover:brightness-95
                          ${s.bg} ${s.border}
                        `}
                        onClick={() => onSelectPatient?.(enc.id)}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${s.dot} ${
                          severity === 'critical' ? 'animate-pulse' : ''
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold text-sm ${s.text}`}>{name}</span>
                            {newMsgCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500 text-white">
                                {newMsgCount} msg
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 m-0">
                            <span className="capitalize">{enc.status.toLowerCase()}</span>
                            {' · '}
                            <span className={`font-semibold ${s.text}`}>{Math.round(mins)}m</span>
                            {enc.chiefComplaint && <> · {enc.chiefComplaint}</>}
                          </p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); dismiss(enc.id); }}
                          title="Dismiss"
                          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-black/5 shrink-0 cursor-pointer text-xs mt-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* ── Summary tab ──────────────────────────────────────── */
              <div className="p-4 space-y-5">
                {/* Average wait */}
                <StatBlock label="Average Wait Time" value={`${avgWaitMins} min`}
                  color={avgWaitMins >= 45 ? 'red' : avgWaitMins >= 15 ? 'amber' : 'green'} />

                <StatBlock label="Total Patients" value={String(encounters.length)} color="gray" />

                {/* CTAS breakdown */}
                {ctasBreakdown.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">CTAS Breakdown</h4>
                    <div className="space-y-1.5">
                      {ctasBreakdown.map(c => (
                        <div key={c.level} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-sm text-[8px] font-bold flex items-center justify-center text-white ${
                              c.level === 1 ? 'bg-red-500' :
                              c.level === 2 ? 'bg-orange-500' :
                              c.level === 3 ? 'bg-amber-500' :
                              c.level === 4 ? 'bg-blue-500' : 'bg-gray-400'
                            }`}>
                              {c.level}
                            </span>
                            <span className="text-xs text-gray-600">CTAS {c.level}</span>
                          </div>
                          <span className="text-xs font-semibold text-gray-800">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status breakdown */}
                {statusBreakdown.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">By Status</h4>
                    <div className="space-y-1.5">
                      {statusBreakdown.map(c => (
                        <div key={c.status} className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 capitalize">{c.status.toLowerCase()}</span>
                          <span className="text-xs font-semibold text-gray-800">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Longest waits */}
                {encounters.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Longest Waits</h4>
                    <div className="space-y-1.5">
                      {[...encounters]
                        .sort((a, b) => minutesSince(waitingSince(a)) - minutesSince(waitingSince(b)))
                        .reverse()
                        .slice(0, 5)
                        .map(enc => {
                          const mins = Math.round(minutesSince(waitingSince(enc)));
                          const sev = waitSeverity(mins);
                          return (
                            <div
                              key={enc.id}
                              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 -mx-1"
                              onClick={() => onSelectPatient?.(enc.id)}
                            >
                              <span className="text-xs text-gray-600 truncate">{patientName(enc.patient)}</span>
                              <span className={`text-xs font-semibold ${SEV[sev].text}`}>{mins}m</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop (click to close, below navbar) */}
      {open && (
        <div
          className="fixed left-0 right-0 bottom-0 z-20 bg-black/10"
          style={{ top: NAV_HEIGHT }}
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ─── Stat block helper ──────────────────────────────────────────────────────

function StatBlock({ label, value, color }: { label: string; value: string; color: 'red' | 'amber' | 'green' | 'gray' }) {
  const colors = {
    red: 'bg-red-50 border-red-200 text-red-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${colors[color]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}
