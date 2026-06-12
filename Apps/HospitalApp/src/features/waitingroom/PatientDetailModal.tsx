import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import type { ChatMessage, Encounter, TriageAssessment } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { CTASBadge } from '../../shared/ui/Badge';
import { StatusPill } from '../../shared/ui/StatusPill';
import {
  DASHBOARD_STATUS_THEME,
  formatDashboardElapsedMinutes,
  formatDashboardPatientSex,
  getDashboardAvatarTheme,
  getDashboardInitials,
} from '../../shared/ui/dashboardTheme';
import { ChatPanel } from './ChatPanel';
import { generatePatientPdf } from './generatePatientPdf';

type Tab = 'messages' | 'profile' | 'remove';

interface PatientDetailModalProps {
  encounter: Encounter | null;
  messages: ChatMessage[];
  onSendMessage: (encounterId: number, text: string) => Promise<void>;
  onRemovePatient: (encounterId: number) => Promise<void>;
  onClose: () => void;
}

const DEFAULT_MODAL_WIDTH = 1160;
const DEFAULT_MODAL_HEIGHT = 780;
const MIN_MODAL_WIDTH = 920;
const MIN_MODAL_HEIGHT = 680;
const TAB_ORDER: Tab[] = ['messages', 'profile', 'remove'];

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

function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60_000);
}

function getWarnings(encounter: Encounter): string[] {
  const notes: string[] = [];
  const patient = encounter.patient;

  if (patient?.allergies) notes.push(patient.allergies);
  if (patient?.conditions) notes.push(patient.conditions);

  if (patient?.optionalHealthInfo) {
    const info = patient.optionalHealthInfo as Record<string, unknown>;
    if (Array.isArray(info.warningNotes)) notes.push(...(info.warningNotes as string[]));
    else if (typeof info.warningNotes === 'string') notes.push(info.warningNotes);
  }

  return notes;
}

function getLatestTriage(encounter: Encounter): TriageAssessment | null {
  const triageAssessments = 'triageAssessments' in encounter ? encounter.triageAssessments : undefined;
  if (!triageAssessments || triageAssessments.length === 0) return null;
  return triageAssessments[triageAssessments.length - 1];
}

function getWaitStart(encounter: Encounter): string {
  return encounter.waitingAt ?? encounter.triagedAt ?? encounter.arrivedAt ?? encounter.createdAt;
}

export function PatientDetailModal({
  encounter,
  messages,
  onSendMessage,
  onRemovePatient,
  onClose,
}: PatientDetailModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>('messages');
  const [expanded, setExpanded] = useState(false);
  const [panelSize, setPanelSize] = useState({ width: DEFAULT_MODAL_WIDTH, height: DEFAULT_MODAL_HEIGHT });

  useEffect(() => {
    if (!encounter) return;
    setTab('messages');
    setExpanded(false);
    setPanelSize({ width: DEFAULT_MODAL_WIDTH, height: DEFAULT_MODAL_HEIGHT });
  }, [encounter?.id]);

  useEffect(() => {
    if (!encounter) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [encounter, onClose]);

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      if (expanded) return;

      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = panelSize.width;
      const startHeight = panelSize.height;

      const onMove = (moveEvent: MouseEvent) => {
        const nextWidth = Math.min(
          window.innerWidth - 24,
          Math.max(MIN_MODAL_WIDTH, startWidth + (moveEvent.clientX - startX)),
        );
        const nextHeight = Math.min(
          window.innerHeight - 24,
          Math.max(MIN_MODAL_HEIGHT, startHeight + (moveEvent.clientY - startY)),
        );

        setPanelSize({ width: nextWidth, height: nextHeight });
      };

      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [expanded, panelSize.height, panelSize.width],
  );

  if (!encounter) return null;

  const latestTriage = getLatestTriage(encounter);
  const avatarTheme = getDashboardAvatarTheme(encounter.patientId);
  const name = patientName(encounter.patient);
  const initials = getDashboardInitials(name);
  const waitMinutes = minutesSince(getWaitStart(encounter));
  const statusTheme = DASHBOARD_STATUS_THEME[encounter.status].cardPill;
  const patientSex = formatDashboardPatientSex(encounter.patient.gender);
  const patientAge = encounter.patient.age != null ? `AGE: ${encounter.patient.age}` : 'AGE: N/A';
  const language = encounter.patient.preferredLanguage?.toUpperCase() ?? 'EN';
  const vitals = latestTriage?.vitalSigns ?? null;
  const activeTabIndex = TAB_ORDER.indexOf(tab);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'messages', label: `Messages (${messages.length})` },
    { key: 'profile', label: 'Patient Profile' },
    { key: 'remove', label: 'Remove' },
  ];

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 animate-fade-in"
      onClick={(event) => {
        if (event.target === backdropRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[3px]" />

      <div
        className="
          relative flex w-full flex-col overflow-hidden rounded-[34px] border border-white/80
          bg-[radial-gradient(circle_at_top,_rgba(254,242,242,0.42)_0%,_rgba(255,255,255,0.92)_34%,_rgba(248,250,252,1)_100%)]
          shadow-[0_32px_90px_-48px_rgba(15,23,42,0.55)] animate-slide-up
        "
        style={{
          width: expanded ? 'calc(100vw - 24px)' : `min(calc(100vw - 24px), ${panelSize.width}px)`,
          height: expanded ? 'calc(100vh - 24px)' : `min(calc(100vh - 24px), ${panelSize.height}px)`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {!expanded && (
          <button
            onMouseDown={handleResizeStart}
            className="absolute bottom-2 right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:text-slate-500 cursor-nwse-resize"
            title="Drag to resize"
            aria-label="Drag to resize"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 10 10 6M9 12l3-3M12 15l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <div className="relative overflow-hidden border-b border-slate-200/80 bg-white/78">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,_rgba(219,234,254,0.8)_0%,_transparent_62%)]" />

          <div className="relative px-6 pb-4 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] text-lg font-bold text-white shadow-[0_22px_48px_-24px_rgba(15,23,42,0.55)]"
                  style={{ backgroundImage: avatarTheme.gradient }}
                >
                  {initials}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-hospital-display text-[1.75rem] font-semibold tracking-[-0.04em] text-slate-950">
                      {name}
                    </h2>
                    <StatusPill
                      status={encounter.status}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold tracking-[0.16em] ${statusTheme}`}
                    />
                    {encounter.currentCtasLevel && <CTASBadge level={encounter.currentCtasLevel} size="md" />}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    <span>{patientSex}</span>
                    <span>{patientAge}</span>
                    <span>#{encounter.id}</span>
                    <span>{language}</span>
                    {encounter.patient.phone && <span>{encounter.patient.phone}</span>}
                  </div>

                  <p className="mt-4 max-w-3xl text-[1.08rem] font-semibold leading-7 text-slate-800">
                    {encounter.chiefComplaint ?? 'No complaint recorded'}
                  </p>

                  {encounter.details && (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{encounter.details}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpanded((value) => !value)}
                  className="
                    flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-slate-200/80 bg-white/88
                    text-slate-400 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.45)] transition-colors hover:text-slate-600
                    hover:border-slate-300 hover:bg-white cursor-pointer
                  "
                  title={expanded ? 'Collapse popup' : 'Expand to fullscreen'}
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
                  onClick={onClose}
                  className="
                    flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-slate-200/80 bg-white/88
                    text-slate-400 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.45)] transition-colors hover:text-slate-600
                    hover:border-slate-300 hover:bg-white cursor-pointer
                  "
                  title="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-slate-200/80 pt-4">
              <HeaderInlineStat label="Elapsed" value={formatDashboardElapsedMinutes(waitMinutes)} />
              <HeaderInlineStat label="Arrived" value={formatTimestamp(encounter.arrivedAt)} />
              <HeaderInlineStat label="Messages" value={String(messages.length)} />
            </div>

            {vitals && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {vitals.heartRate && <VitalPill label="Heart rate" value={`${vitals.heartRate} bpm`} />}
                {vitals.bloodPressure && <VitalPill label="Blood pressure" value={vitals.bloodPressure} />}
                {vitals.oxygenSaturation && <VitalPill label="SpO2" value={`${vitals.oxygenSaturation}%`} />}
                {vitals.temperature && <VitalPill label="Temperature" value={`${vitals.temperature} C`} />}
                {vitals.respiratoryRate && <VitalPill label="Respiratory" value={`${vitals.respiratoryRate}/min`} />}
              </div>
            )}
          </div>
        </div>

        <div className="border-b border-slate-200/80 bg-white/74 px-6 pt-3">
          <div className="flex items-end justify-between gap-4">
            <div className="relative grid max-w-[640px] flex-1 grid-cols-3">
              {tabs.map((tabOption) => {
                const isActive = tab === tabOption.key;
                return (
                  <button
                    key={tabOption.key}
                    onClick={() => setTab(tabOption.key)}
                    className={`
                      relative pb-3 text-left text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap
                      ${isActive
                        ? tabOption.key === 'remove'
                          ? 'text-rose-700'
                          : 'text-slate-900'
                        : tabOption.key === 'remove'
                          ? 'text-rose-500 hover:text-rose-700'
                          : 'text-slate-500 hover:text-slate-800'
                      }
                    `}
                  >
                    {tabOption.label}
                  </button>
                );
              })}
              <div
                className={`absolute bottom-0 h-0.5 w-1/3 transition-transform duration-300 ease-out ${tab === 'remove' ? 'bg-rose-600' : 'bg-slate-900'}`}
                style={{ transform: `translateX(${activeTabIndex * 100}%)` }}
              />
            </div>

            <button
              onClick={() => generatePatientPdf(encounter)}
              className="
                mb-2 inline-flex items-center gap-2 rounded-[16px] border border-priage-200 bg-priage-50/88 px-4 py-2.5 text-sm
                font-semibold text-priage-700 shadow-[0_16px_34px_-28px_rgba(30,58,95,0.45)] transition-all
                hover:border-priage-300 hover:bg-priage-100 hover:text-priage-800 cursor-pointer
              "
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Download PDF
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 px-4 pb-4 pt-4">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.32)]">
            {tab === 'messages' ? (
              <ChatPanel encounter={encounter} messages={messages} onSendMessage={onSendMessage} hideHeader />
            ) : tab === 'profile' ? (
              <PatientProfile encounter={encounter} latestTriage={latestTriage} />
            ) : (
              <RemovePatientPanel encounter={encounter} onRemovePatient={onRemovePatient} onClose={onClose} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderInlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <span className="whitespace-nowrap font-hospital-display text-base font-semibold tracking-[-0.03em] text-slate-900">
        {value}
      </span>
    </div>
  );
}

function VitalPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/82 px-3 py-1.5 text-xs font-medium text-slate-600">
      <span className="font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </span>
  );
}

function PatientProfile({
  encounter,
  latestTriage,
}: {
  encounter: Encounter;
  latestTriage: TriageAssessment | null;
}) {
  const warnings = getWarnings(encounter);
  const vitals = latestTriage?.vitalSigns ?? null;
  const patient = encounter.patient;

  return (
    <div className="h-full overflow-y-auto px-5 py-5 custom-scrollbar">
      <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <SectionCard eyebrow="Identity" title="Patient Information">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoField label="Full Name" value={patientName(patient)} />
            <InfoField label="Encounter ID" value={`#${encounter.id}`} />
            <InfoField label="Sex" value={formatDashboardPatientSex(patient.gender)} />
            <InfoField label="Age" value={patient.age != null ? `${patient.age} years` : 'Not recorded'} />
            <InfoField label="Phone" value={patient.phone ?? 'Not recorded'} />
            <InfoField label="Language" value={patient.preferredLanguage?.toUpperCase() ?? 'EN'} />
            <InfoField label="Height" value={patient.heightCm != null ? `${patient.heightCm} cm` : 'Not recorded'} />
            <InfoField label="Weight" value={patient.weightKg != null ? `${patient.weightKg} kg` : 'Not recorded'} />
          </div>
        </SectionCard>

        <SectionCard eyebrow="Presentation" title="Chief Complaint">
          <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/88 px-4 py-4">
            <p className="m-0 text-base font-semibold leading-7 text-slate-800">
              {encounter.chiefComplaint ?? 'No complaint recorded'}
            </p>
            {encounter.details && (
              <p className="mt-3 text-sm leading-6 text-slate-500">{encounter.details}</p>
            )}
          </div>
        </SectionCard>

        {warnings.length > 0 && (
          <SectionCard eyebrow="Safety" title="Medical Alerts" tone="rose">
            <div className="flex flex-wrap gap-2">
              {warnings.map((warning, index) => (
                <span
                  key={`${warning}-${index}`}
                  className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                >
                  {warning}
                </span>
              ))}
            </div>
          </SectionCard>
        )}

        {latestTriage && (
          <SectionCard eyebrow="Clinical" title="Latest Triage Assessment">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="CTAS Level" value={String(latestTriage.ctasLevel)} />
              <MetricTile label="Priority Score" value={String(latestTriage.priorityScore)} />
              <MetricTile label="Pain" value={latestTriage.painLevel != null ? `${latestTriage.painLevel}/10` : 'N/A'} />
              <MetricTile label="Assessed" value={formatTimestamp(latestTriage.createdAt)} />
            </div>

            {vitals && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <VitalMetric label="Blood Pressure" value={vitals.bloodPressure} />
                <VitalMetric label="Heart Rate" value={vitals.heartRate != null ? `${vitals.heartRate} bpm` : null} />
                <VitalMetric label="Temperature" value={vitals.temperature != null ? `${vitals.temperature} C` : null} />
                <VitalMetric
                  label="Respiratory Rate"
                  value={vitals.respiratoryRate != null ? `${vitals.respiratoryRate}/min` : null}
                />
                <VitalMetric label="SpO2" value={vitals.oxygenSaturation != null ? `${vitals.oxygenSaturation}%` : null} />
              </div>
            )}

            {latestTriage.note && (
              <div className="mt-4 rounded-[20px] border border-slate-200/80 bg-slate-50/88 px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Clinical note
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{latestTriage.note}</p>
              </div>
            )}
          </SectionCard>
        )}

        <SectionCard eyebrow="Flow" title="Encounter Timeline">
          <div className="space-y-4">
            <TimelineItem label="Expected" time={encounter.expectedAt} />
            <TimelineItem label="Arrived" time={encounter.arrivedAt} />
            <TimelineItem label="Triage Started" time={encounter.triagedAt} />
            <TimelineItem label="Waiting" time={encounter.waitingAt} />
            <TimelineItem label="Seen" time={encounter.seenAt} />
            <TimelineItem label="Departed" time={encounter.departedAt} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  children,
  tone = 'default',
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  tone?: 'default' | 'rose';
}) {
  const toneClass =
    tone === 'rose'
      ? 'border-rose-100/90 bg-[linear-gradient(180deg,_rgba(255,241,242,0.95)_0%,_rgba(255,255,255,0.94)_100%)]'
      : 'border-white/80 bg-white/92';

  return (
    <section className={`rounded-[24px] border p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.42)] ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</div>
      <h3 className="mt-2 font-hospital-display text-xl font-semibold tracking-[-0.03em] text-slate-900">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/88 px-4 py-3 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.34)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/88 px-4 py-3 text-center shadow-[0_16px_32px_-30px_rgba(15,23,42,0.34)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

function VitalMetric({ label, value }: { label: string; value: string | null | undefined }) {
  return <MetricTile label={label} value={value ?? 'Not recorded'} />;
}

function TimelineItem({ label, time }: { label: string; time: string | null | undefined }) {
  const isActive = Boolean(time);

  return (
    <div className="flex items-start gap-3">
      <div className={`mt-1.5 h-2.5 w-2.5 rounded-full ${isActive ? 'bg-priage-500' : 'bg-slate-300'}`} />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="text-xs text-slate-500">{formatTimestamp(time)}</div>
      </div>
    </div>
  );
}

function RemovePatientPanel({
  encounter,
  onRemovePatient,
  onClose,
}: {
  encounter: Encounter;
  onRemovePatient: (encounterId: number) => Promise<void>;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const name = patientName(encounter.patient);

  const handleClick = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setRemoving(true);
    try {
      await onRemovePatient(encounter.id);
      onClose();
    } catch {
      setRemoving(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(254,226,226,0.45)_0%,_rgba(255,255,255,1)_62%)] p-6">
      <div className="w-full max-w-xl rounded-[28px] border border-rose-200/80 bg-white/94 p-8 text-center shadow-[0_28px_70px_-42px_rgba(190,24,93,0.35)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-rose-100 text-2xl text-rose-600">
          !
        </div>

        <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-500">
          Remove from waiting room
        </div>
        <h3 className="mt-2 font-hospital-display text-[1.65rem] font-semibold tracking-[-0.04em] text-slate-950">
          Remove Patient
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
          You are about to remove <span className="font-semibold text-slate-800">{name}</span> (#{encounter.id}) from
          the waiting room. This action cannot be undone.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleClick}
            disabled={removing}
            className={`
              rounded-[16px] px-5 py-3 text-sm font-semibold transition-all cursor-pointer
              ${confirming
                ? 'bg-rose-700 text-white shadow-[0_18px_38px_-24px_rgba(190,24,93,0.9)] hover:bg-rose-800'
                : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              }
              disabled:cursor-not-allowed disabled:opacity-60
            `}
          >
            {removing ? 'Removing...' : confirming ? 'Confirm removal' : 'Remove patient'}
          </button>

          {confirming && !removing && (
            <button
              onClick={() => setConfirming(false)}
              className="rounded-[16px] border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
