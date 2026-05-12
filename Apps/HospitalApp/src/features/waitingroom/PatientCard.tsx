// HospitalApp/src/features/waitingroom/PatientCard.tsx
// Waiting-room patient card aligned to the admittance design system.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Encounter, ChatMessage, AlertSeverity } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { CTASBadge, AlertIndicator } from '../../shared/ui/Badge';
import { StatusPill } from '../../shared/ui/StatusPill';
import {
  DASHBOARD_STATUS_THEME,
  formatDashboardElapsedMinutes,
  formatDashboardPatientSex,
  getDashboardAvatarTheme,
  getDashboardInitials,
} from '../../shared/ui/dashboardTheme';
import type { QueueEntry } from '../../shared/queue/queuePriority';

interface PatientCardProps {
  encounter: Encounter;
  messages: ChatMessage[];
  alertSeverity?: AlertSeverity | null;
  queueEntry?: QueueEntry | null;
  onClick: () => void;
}

function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60_000);
}

function getWarningNotes(encounter: Encounter): string[] {
  const notes: string[] = [];
  const patient = encounter.patient;
  if (patient?.allergies) notes.push('Allergies');
  if (patient?.conditions) notes.push(patient.conditions);
  if (patient?.optionalHealthInfo) {
    const info = patient.optionalHealthInfo as Record<string, unknown>;
    if (info?.warningNotes) {
      if (Array.isArray(info.warningNotes)) notes.push(...(info.warningNotes as string[]));
      else if (typeof info.warningNotes === 'string') notes.push(info.warningNotes);
    }
  }
  return notes;
}

export function PatientCard({ encounter, messages, alertSeverity, queueEntry, onClick }: PatientCardProps) {
  const [, setTick] = useState(0);
  const [isComplaintOverflowing, setIsComplaintOverflowing] = useState(false);
  const complaintRef = useRef<HTMLParagraphElement | null>(null);

  const name = patientName(encounter.patient);
  const initials = getDashboardInitials(name);
  const avatarTheme = getDashboardAvatarTheme(encounter.patientId);
  const complaint = encounter.chiefComplaint ?? 'No complaint recorded';
  const patientSex = formatDashboardPatientSex(encounter.patient.gender);
  const patientAgeDisplay = encounter.patient.age != null ? `${encounter.patient.age}` : '—';
  const statusPillStyle = DASHBOARD_STATUS_THEME[encounter.status].cardPill;
  const waitStart = encounter.waitingAt ?? encounter.triagedAt ?? encounter.arrivedAt ?? encounter.createdAt;
  const waitMinutes = minutesSince(waitStart);
  const warnings = getWarningNotes(encounter);
  const triageAssessments = 'triageAssessments' in encounter ? encounter.triageAssessments : undefined;
  const latestTriage = triageAssessments?.[triageAssessments.length - 1];
  const vitals = latestTriage?.vitalSigns;
  const messageSummary = messages.length === 0 ? 'No messages' : `${messages.length} message${messages.length === 1 ? '' : 's'}`;

  const queueTone =
    queueEntry?.waitStatus === 'overdue'
      ? 'border-rose-200'
      : queueEntry?.waitStatus === 'approaching'
        ? 'border-amber-200'
        : 'border-[#e2e8f0]';

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const element = complaintRef.current;
    if (!element) return;

    const checkOverflow = () => {
      setIsComplaintOverflowing(element.scrollHeight - element.clientHeight > 2);
    };

    checkOverflow();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', checkOverflow);
      return () => window.removeEventListener('resize', checkOverflow);
    }

    const observer = new ResizeObserver(() => checkOverflow());
    observer.observe(element);
    return () => observer.disconnect();
  }, [complaint]);

  return (
    <div
      onClick={onClick}
      className={`
        group relative flex w-full max-w-sm cursor-pointer flex-col overflow-visible rounded-[10px] border p-4
        transition-colors hover:border-[#cbd5e1]
        ${queueTone}
      `}
      style={{
        backgroundImage: 'none',
        backgroundColor: '#ffffff',
        '--card-accent': avatarTheme.accent,
      } as CSSProperties}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[#f1f5f9]" />

      {alertSeverity ? (
        <div className="absolute -left-[4px] top-[4px] z-20">
          <AlertIndicator severity={alertSeverity} className="shadow-[0_18px_34px_-24px_rgba(15,23,42,0.55)]" />
        </div>
      ) : null}

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] font-mono text-sm font-bold text-white"
            style={{ backgroundImage: avatarTheme.gradient }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight text-slate-800">
              {name}
            </div>
            <div className="mt-0.5 font-mono text-[11px] tracking-wide text-slate-400">
              {patientSex} / AGE {patientAgeDisplay} / #{encounter.id}
            </div>
          </div>
        </div>

        {encounter.currentCtasLevel && (
          <div className="shrink-0 [&>span]:rounded-[4px] [&>span]:border [&>span]:border-slate-200 [&>span]:bg-slate-50 [&>span]:px-2 [&>span]:py-0.5 [&>span]:font-mono [&>span]:text-[10px] [&>span]:font-semibold [&>span]:uppercase [&>span]:text-slate-600">
            <CTASBadge level={encounter.currentCtasLevel} size="sm" />
          </div>
        )}
      </div>

      <div className="relative mt-1">
        <p
          ref={complaintRef}
          className="relative line-clamp-2 pr-8 text-sm leading-snug text-slate-600"
        >
          {complaint}
        </p>
        {isComplaintOverflowing && (
          <span
            className="pointer-events-none absolute bottom-0 right-0 block h-5 w-16 bg-gradient-to-l from-white to-transparent"
            aria-hidden
          />
        )}
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-2 border-t border-[#f1f5f9] pt-3">
        <StatusPill
          status={encounter.status}
          className={`rounded-[4px] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.16em] ${statusPillStyle}`}
        />

        {queueEntry && (
          <span className="inline-flex items-center rounded-[4px] border border-[#e2e8f0] bg-slate-50 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
            Queue #{queueEntry.position}
          </span>
        )}
      </div>

      {(vitals?.heartRate || vitals?.bloodPressure || vitals?.oxygenSaturation || vitals?.temperature) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-slate-500">
          {vitals?.heartRate && <span>HR {vitals.heartRate} bpm</span>}
          {vitals?.bloodPressure && <span>BP {vitals.bloodPressure}</span>}
          {vitals?.oxygenSaturation && <span>SpO₂ {vitals.oxygenSaturation}%</span>}
          {vitals?.temperature && <span>{vitals.temperature}°C</span>}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {warnings.slice(0, 2).map((warning, index) => (
            <span
              key={`${warning}-${index}`}
              className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700"
            >
              {warning.length > 32 ? `${warning.slice(0, 32)}…` : warning}
            </span>
          ))}
          {warnings.length > 2 && (
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              +{warnings.length - 2} more
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 pt-1">
        <div className="flex min-w-0 flex-nowrap items-center gap-2 text-xs text-slate-500">
          <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Waiting</span>
          <span className="whitespace-nowrap font-mono text-[11px] text-slate-700">{formatDashboardElapsedMinutes(waitMinutes)}</span>
        </div>

        <span className="shrink-0 whitespace-nowrap rounded-[4px] border border-[#e2e8f0] bg-slate-50 px-3 py-1 font-mono text-[11px] text-slate-600">
          {messageSummary}
        </span>
      </div>
    </div>
  );
}
