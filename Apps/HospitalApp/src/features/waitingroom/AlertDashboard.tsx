import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import type { ChatMessage, Encounter } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { CTASBadge } from '../../shared/ui/Badge';
import { StatusPill } from '../../shared/ui/StatusPill';
import {
  DASHBOARD_STATUS_THEME,
  formatDashboardElapsedMinutes,
  getDashboardAvatarTheme,
  getDashboardInitials,
} from '../../shared/ui/dashboardTheme';

interface AlertDashboardProps {
  encounters: Encounter[];
  chatMessages: Record<number, ChatMessage[]>;
  onSelectPatient?: (encounterId: number) => void;
}

const NAV_HEIGHT = 56;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 760;
const DEFAULT_PANEL_WIDTH = 420;

type Severity = 'ok' | 'warn' | 'critical';

const SEVERITY_THEME: Record<
  Severity,
  {
    card: string;
    border: string;
    dot: string;
    pill: string;
    text: string;
  }
> = {
  ok: {
    card: 'bg-[linear-gradient(180deg,_rgba(236,253,245,0.94)_0%,_rgba(255,255,255,0.94)_100%)]',
    border: 'border-emerald-200/90',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-100 text-emerald-800',
    text: 'text-emerald-800',
  },
  warn: {
    card: 'bg-[linear-gradient(180deg,_rgba(255,251,235,0.94)_0%,_rgba(255,255,255,0.94)_100%)]',
    border: 'border-amber-200/90',
    dot: 'bg-amber-500',
    pill: 'bg-amber-100 text-amber-800',
    text: 'text-amber-800',
  },
  critical: {
    card: 'bg-[linear-gradient(180deg,_rgba(255,241,242,0.96)_0%,_rgba(255,255,255,0.94)_100%)]',
    border: 'border-rose-200/90',
    dot: 'bg-rose-600',
    pill: 'bg-rose-100 text-rose-800',
    text: 'text-rose-800',
  },
};

function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60_000);
}

function waitingSince(encounter: Encounter): string | null {
  if (encounter.status === 'WAITING' && encounter.waitingAt) return encounter.waitingAt;
  if (encounter.status === 'TRIAGE' && encounter.triagedAt) return encounter.triagedAt;
  return encounter.arrivedAt ?? encounter.createdAt;
}

function waitSeverity(minutes: number): Severity {
  if (minutes >= 45) return 'critical';
  if (minutes >= 15) return 'warn';
  return 'ok';
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Not recorded';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getStatusBreakdown(encounters: Encounter[]) {
  const orderedStatuses: Encounter['status'][] = [
    'EXPECTED',
    'ADMITTED',
    'TRIAGE',
    'WAITING',
    'COMPLETE',
    'UNRESOLVED',
    'CANCELLED',
  ];

  return orderedStatuses
    .map((status) => ({
      status,
      count: encounters.filter((encounter) => encounter.status === status).length,
    }))
    .filter((entry) => entry.count > 0);
}

export function AlertDashboard({ encounters, chatMessages, onSelectPatient }: AlertDashboardProps) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'alerts' | 'summary'>('alerts');
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [expanded, setExpanded] = useState(false);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_PANEL_WIDTH);
  const seenMsgCounts = useRef<Record<number, number>>({});
  const [, forceUpdate] = useState(0);

  const onDragStart = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      isDragging.current = true;
      dragStartX.current = event.clientX;
      dragStartWidth.current = panelWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = dragStartX.current - moveEvent.clientX;
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
    },
    [panelWidth],
  );

  useEffect(() => {
    const baseline: Record<number, number> = {};
    for (const encounter of encounters) {
      const messages = chatMessages[encounter.id] || [];
      baseline[encounter.id] = messages.filter((message) => message.sender === 'patient').length;
    }
    seenMsgCounts.current = baseline;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => forceUpdate((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const dismiss = useCallback((encounterId: number) => {
    setDismissed((previous) => new Set(previous).add(encounterId));
  }, []);

  const items = encounters
    .filter((encounter) => !dismissed.has(encounter.id))
    .map((encounter) => {
      const since = waitingSince(encounter);
      const minutes = minutesSince(since);
      const severity = waitSeverity(minutes);
      const name = patientName(encounter.patient);
      const patientMessages = (chatMessages[encounter.id] || []).filter((message) => message.sender === 'patient').length;
      const baselineCount = seenMsgCounts.current[encounter.id] ?? 0;
      const newMessageCount = Math.max(0, patientMessages - baselineCount);

      return {
        encounter,
        minutes,
        severity,
        name,
        newMessageCount,
      };
    });

  const order: Record<Severity, number> = { critical: 0, warn: 1, ok: 2 };
  items.sort((left, right) => order[left.severity] - order[right.severity]);

  const criticalCount = items.filter((item) => item.severity === 'critical').length;
  const warningCount = items.filter((item) => item.severity === 'warn').length;
  const messageCount = items.reduce((sum, item) => sum + item.newMessageCount, 0);
  const totalAlerts = criticalCount + warningCount;

  const averageWaitMinutes =
    encounters.length > 0
      ? Math.round(encounters.reduce((sum, encounter) => sum + minutesSince(waitingSince(encounter)), 0) / encounters.length)
      : 0;

  const ctasBreakdown = [1, 2, 3, 4, 5]
    .map((level) => ({
      level,
      count: encounters.filter((encounter) => encounter.currentCtasLevel === level).length,
    }))
    .filter((entry) => entry.count > 0);

  const statusBreakdown = getStatusBreakdown(encounters);

  const longestWaits = [...encounters]
    .sort((left, right) => minutesSince(waitingSince(right)) - minutesSince(waitingSince(left)))
    .slice(0, 5);

  const messageLeaders = items
    .filter((item) => item.newMessageCount > 0)
    .sort((left, right) => right.newMessageCount - left.newMessageCount)
    .slice(0, 5);

  return (
    <>
      <button
        onClick={() => setOpen((value) => !value)}
        className={`
          fixed right-0 z-40 cursor-pointer rounded-l-[20px] border border-r-0 px-3 py-4 shadow-[0_18px_42px_-24px_rgba(15,23,42,0.45)]
          transition-all duration-300
          ${totalAlerts > 0
            ? 'border-rose-700 bg-rose-700 text-white hover:bg-rose-800'
            : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-50'
          }
        `}
        style={{
          top: `calc(50% + ${NAV_HEIGHT / 2}px)`,
          transform: 'translateY(-50%)',
          writingMode: 'vertical-lr',
          textOrientation: 'mixed',
        }}
        title={open ? 'Close alerts panel' : 'Open alerts panel'}
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
          {open ? 'Close' : 'Alerts'}
        </span>
        <span className={`mt-2 rounded-full px-2 py-1 text-[11px] font-bold ${open ? 'bg-white/18' : totalAlerts > 0 ? 'bg-white/18' : 'bg-slate-100 text-slate-700'}`}>
          {totalAlerts}
        </span>
        {messageCount > 0 && !open && (
          <span className="absolute -left-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-priage-600 px-1.5 text-[10px] font-bold text-white">
            {messageCount}
          </span>
        )}
      </button>

      <div
        className={`fixed right-0 z-30 transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          top: NAV_HEIGHT,
          height: `calc(100vh - ${NAV_HEIGHT}px)`,
          width: expanded ? '100vw' : panelWidth,
          transition: expanded ? 'width 0.3s ease-out' : undefined,
        }}
      >
        <div className="relative flex h-full flex-col overflow-hidden border-l border-white/80 bg-[linear-gradient(180deg,_rgba(248,250,252,0.98)_0%,_rgba(255,255,255,0.96)_40%,_rgba(241,245,249,0.98)_100%)] shadow-[-18px_0_60px_-38px_rgba(15,23,42,0.45)]">
          {!expanded && (
            <div
              onMouseDown={onDragStart}
              className="absolute left-0 top-0 bottom-0 z-20 flex w-2.5 cursor-col-resize items-center justify-center transition-colors hover:bg-priage-200/40 active:bg-priage-400/40"
              title="Drag to resize"
            >
              <div className="flex h-14 items-center gap-1 opacity-35 transition-opacity hover:opacity-75">
                <span className="h-7 w-px rounded-full bg-slate-500" />
                <span className="h-7 w-px rounded-full bg-slate-500" />
              </div>
            </div>
          )}

          <div className="relative border-b border-slate-200/80 bg-white/78 px-5 pb-4 pt-5 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_right,_rgba(219,234,254,0.74)_0%,_transparent_64%)]" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Waiting room intelligence
                </div>
                <h2 className="mt-2 font-hospital-display text-[1.45rem] font-semibold tracking-[-0.04em] text-slate-950">
                  Alerts and flow
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                  Active wait-time risk, patient messaging, and throughput signals in one place.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpanded((value) => !value)}
                  className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-slate-200/80 bg-white/90 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 cursor-pointer"
                  title={expanded ? 'Collapse to side panel' : 'Expand to full view'}
                >
                  {expanded ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M10 2v4h4M6 14v-4H2M10 6L14 2M6 10l-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M14 2l-4 4M2 14l4-4M10 2h4v4M6 14H2v-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => {
                    setOpen(false);
                    setExpanded(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-slate-200/80 bg-white/90 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 cursor-pointer"
                  title="Close panel"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="relative mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PanelStatCard label="Active alerts" value={String(totalAlerts)} tone={totalAlerts > 0 ? 'rose' : 'slate'} />
              <PanelStatCard label="Critical waits" value={String(criticalCount)} tone={criticalCount > 0 ? 'rose' : 'slate'} />
              <PanelStatCard label="New messages" value={String(messageCount)} tone={messageCount > 0 ? 'amber' : 'slate'} />
              <PanelStatCard
                label="Average wait"
                value={formatDashboardElapsedMinutes(averageWaitMinutes)}
                tone={averageWaitMinutes >= 45 ? 'rose' : averageWaitMinutes >= 15 ? 'amber' : 'emerald'}
              />
            </div>

            <div className="relative mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-[18px] border border-slate-200/80 bg-slate-50/90 p-1 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.34)]">
                {(['alerts', 'summary'] as const).map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`
                        rounded-[14px] px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer
                        ${isActive
                          ? 'bg-slate-900 text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.82)]'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900'
                        }
                      `}
                    >
                      {tab === 'alerts' ? `Alerts (${totalAlerts})` : 'Summary'}
                    </button>
                  );
                })}
              </div>

              <div className="text-xs font-medium text-slate-500">
                {criticalCount > 0 || warningCount > 0
                  ? `${criticalCount} critical, ${warningCount} warning`
                  : 'All waits currently on time'}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
            {activeTab === 'alerts' ? (
              items.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="max-w-sm rounded-[28px] border border-white/80 bg-white/92 px-6 py-8 text-center shadow-[0_24px_60px_-42px_rgba(15,23,42,0.42)]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-500">
                      All clear
                    </div>
                    <div className="mt-2 font-hospital-display text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                      No active alerts
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Waiting times and patient messages are currently within threshold.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map(({ encounter, minutes, severity, name, newMessageCount }) => {
                    const avatarTheme = getDashboardAvatarTheme(encounter.patientId);
                    const severityTheme = SEVERITY_THEME[severity];

                    return (
                      <div
                        key={encounter.id}
                        onClick={() => onSelectPatient?.(encounter.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onSelectPatient?.(encounter.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className={`
                          group w-full cursor-pointer rounded-[24px] border p-4 text-left shadow-[0_22px_54px_-40px_rgba(15,23,42,0.4)]
                          transition-all hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-36px_rgba(15,23,42,0.45)]
                          focus:outline-none focus:ring-2 focus:ring-priage-200
                          ${severityTheme.card} ${severityTheme.border}
                        `}
                      >
                        <div className="flex items-start gap-4">
                          <div className="relative shrink-0">
                            <div
                              className="flex h-12 w-12 items-center justify-center rounded-[18px] text-sm font-bold text-white shadow-[0_16px_38px_-22px_rgba(15,23,42,0.5)]"
                              style={{ backgroundImage: avatarTheme.gradient }}
                            >
                              {getDashboardInitials(name)}
                            </div>
                            <span
                              className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${severityTheme.dot} ${severity === 'critical' ? 'animate-pulse-dot' : ''}`}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate font-hospital-display text-lg font-semibold tracking-[-0.03em] text-slate-950">
                                {name}
                              </div>
                              <StatusPill
                                status={encounter.status}
                                className={`rounded-md px-2 py-1 text-[10px] font-bold tracking-[0.16em] ${DASHBOARD_STATUS_THEME[encounter.status].cardPill}`}
                              />
                              {encounter.currentCtasLevel && <CTASBadge level={encounter.currentCtasLevel} />}
                              {newMessageCount > 0 && (
                                <span className="inline-flex items-center rounded-full bg-priage-600 px-2.5 py-1 text-[10px] font-bold text-white">
                                  {newMessageCount} new
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              <span className={`rounded-full px-2.5 py-1 ${severityTheme.pill}`}>
                                {severity === 'critical' ? 'Critical wait' : severity === 'warn' ? 'Warning wait' : 'On time'}
                              </span>
                              <span>{formatDashboardElapsedMinutes(minutes)} elapsed</span>
                              <span>{formatTimestamp(waitingSince(encounter))}</span>
                            </div>

                            <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-slate-700">
                              {encounter.chiefComplaint ?? 'No complaint recorded'}
                            </p>

                            <div className="mt-4 flex items-center justify-between gap-3">
                              <div className="min-w-0 text-xs text-slate-500">
                                <span className={`font-semibold ${severityTheme.text}`}>{Math.round(minutes)} min waiting</span>
                                {' · '}
                                <span>{encounter.patient.phone ?? 'No phone on file'}</span>
                              </div>

                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  dismiss(encounter.id);
                                }}
                                className="rounded-[12px] border border-white/80 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 cursor-pointer"
                                title="Dismiss alert"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-2">
                  <PanelSection eyebrow="Performance" title="CTAS Breakdown">
                    <div className="space-y-3">
                      {ctasBreakdown.map((entry) => (
                        <BreakdownRow
                          key={entry.level}
                          label={<CTASBadge level={entry.level} size="md" />}
                          value={String(entry.count)}
                        />
                      ))}
                    </div>
                  </PanelSection>

                  <PanelSection eyebrow="Flow" title="Status Breakdown">
                    <div className="space-y-3">
                      {statusBreakdown.map((entry) => (
                        <BreakdownRow
                          key={entry.status}
                          label={
                            <StatusPill
                              status={entry.status}
                              className={`rounded-md px-2 py-1 text-[10px] font-bold tracking-[0.16em] ${DASHBOARD_STATUS_THEME[entry.status].cardPill}`}
                            />
                          }
                          value={String(entry.count)}
                        />
                      ))}
                    </div>
                  </PanelSection>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <PanelSection eyebrow="Priority" title="Longest Waits">
                    <div className="space-y-3">
                      {longestWaits.map((encounter) => {
                        const minutes = minutesSince(waitingSince(encounter));
                        const severity = waitSeverity(minutes);
                        const theme = SEVERITY_THEME[severity];

                        return (
                          <button
                            key={encounter.id}
                            onClick={() => onSelectPatient?.(encounter.id)}
                            className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50/85 px-3 py-3 text-left transition-colors hover:border-slate-300 hover:bg-white cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-800">
                                {patientName(encounter.patient)}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{encounter.chiefComplaint ?? 'No complaint recorded'}</div>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${theme.pill}`}>
                              {formatDashboardElapsedMinutes(minutes)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </PanelSection>

                  <PanelSection eyebrow="Communication" title="Unread Patient Messages">
                    {messageLeaders.length > 0 ? (
                      <div className="space-y-3">
                        {messageLeaders.map((item) => (
                          <button
                            key={item.encounter.id}
                            onClick={() => onSelectPatient?.(item.encounter.id)}
                            className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50/85 px-3 py-3 text-left transition-colors hover:border-slate-300 hover:bg-white cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-800">{item.name}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {item.encounter.chiefComplaint ?? 'No complaint recorded'}
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full bg-priage-600 px-2.5 py-1 text-xs font-semibold text-white">
                              {item.newMessageCount}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/85 px-4 py-4 text-sm text-slate-500">
                        No new patient messages right now.
                      </div>
                    )}
                  </PanelSection>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div
          className="fixed left-0 right-0 bottom-0 z-20 bg-black/12"
          style={{ top: NAV_HEIGHT }}
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PanelStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const toneClasses = {
    emerald: 'border-emerald-200 bg-emerald-50/90 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50/90 text-amber-900',
    rose: 'border-rose-200 bg-rose-50/90 text-rose-900',
    slate: 'border-slate-200 bg-white/92 text-slate-900',
  };

  return (
    <div className={`rounded-[22px] border px-4 py-3 shadow-[0_20px_44px_-36px_rgba(15,23,42,0.42)] ${toneClasses[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-1 font-hospital-display text-[1.4rem] font-semibold tracking-[-0.03em]">{value}</div>
    </div>
  );
}

function PanelSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-white/80 bg-white/92 p-5 shadow-[0_22px_50px_-40px_rgba(15,23,42,0.42)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</div>
      <h3 className="mt-2 font-hospital-display text-xl font-semibold tracking-[-0.03em] text-slate-900">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BreakdownRow({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50/85 px-3 py-3">
      <div className="min-w-0">{label}</div>
      <div className="shrink-0 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}
