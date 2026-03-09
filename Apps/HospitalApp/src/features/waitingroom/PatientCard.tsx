// HospitalApp/src/features/waitingroom/PatientCard.tsx
// Individual patient cell in the waiting room grid dashboard.

import { useState, useEffect } from 'react';
import type { Encounter, ChatMessage, AlertSeverity } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { CTASBadge, CountBadge, AlertIndicator } from '../../shared/ui/Badge';

interface PatientCardProps {
  encounter: Encounter;
  messages: ChatMessage[];
  unreadCount: number;
  alertSeverity?: AlertSeverity | null;
  onClick: () => void;
}

function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 60_000);
}

function formatWaitTime(minutes: number): string {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getWarningNotes(encounter: Encounter): string[] {
  const notes: string[] = [];
  const p = encounter.patient;
  if (p?.allergies) notes.push(`⚠ ${p.allergies}`);
  if (p?.conditions) notes.push(p.conditions);
  // Check optionalHealthInfo for warning flags
  if (p?.optionalHealthInfo) {
    const info = p.optionalHealthInfo as Record<string, unknown>;
    if (info?.warningNotes) {
      if (Array.isArray(info.warningNotes)) notes.push(...(info.warningNotes as string[]));
      else if (typeof info.warningNotes === 'string') notes.push(info.warningNotes);
    }
  }
  return notes;
}

function waitTimeColor(minutes: number): string {
  if (minutes >= 45) return 'text-red-600';
  if (minutes >= 15) return 'text-amber-600';
  return 'text-green-600';
}

export function PatientCard({ encounter, messages, unreadCount, alertSeverity, onClick }: PatientCardProps) {
  const [, setTick] = useState(0);
  const name = patientName(encounter.patient);
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const ctas = encounter.currentCtasLevel;
  const complaint = encounter.chiefComplaint ?? 'No complaint recorded';

  // Get baseline vitals from triage assessments
  const latestTriage = encounter.triageAssessments?.[encounter.triageAssessments.length - 1];
  const vs = latestTriage?.vitalSigns;
  const bp = vs?.bloodPressure?.split('/');
  const vitals = {
    heartRate: vs?.heartRate ?? null,
    systolic: bp?.[0] ? parseInt(bp[0], 10) : null,
    diastolic: bp?.[1] ? parseInt(bp[1], 10) : null,
    oxygenSaturation: vs?.oxygenSaturation ?? null,
    temperature: vs?.temperature ?? null,
  };

  const waitStart = encounter.waitingAt ?? encounter.triagedAt ?? encounter.arrivedAt ?? encounter.createdAt;
  const waitMins = minutesSince(waitStart);

  const warnings = getWarningNotes(encounter);

  // Refresh wait time every 30s
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      onClick={onClick}
      className="
        relative bg-white rounded-xl border border-gray-200
        shadow-sm hover:shadow-md hover:border-priage-300
        transition-all duration-200 cursor-pointer
        p-4 flex flex-col gap-2.5
        group
      "
    >
      {/* ── Top-left: Alert indicator ── */}
      {alertSeverity && (
        <div className="absolute -top-2 -left-2 z-10">
          <AlertIndicator severity={alertSeverity} />
        </div>
      )}

      {/* ── Top-right: Unread message count ── */}
      {unreadCount > 0 && (
        <div className="absolute -top-2 -right-2 z-10">
          <CountBadge count={unreadCount} variant="green" />
        </div>
      )}

      {/* ── Header: Name + CTAS ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-priage-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-gray-900 truncate">{name}</div>
            <div className="text-[11px] text-gray-500">
              {encounter.patient.age ? `${encounter.patient.age}y` : ''}{' '}
              {encounter.patient.gender ? `· ${encounter.patient.gender}` : ''}{' '}
              · #{encounter.id}
            </div>
          </div>
        </div>
        {ctas && <CTASBadge level={ctas} />}
      </div>

      {/* ── Complaint ── */}
      <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 m-0">
        {complaint.length > 60 ? complaint.slice(0, 60) + '…' : complaint}
      </p>

      {/* ── Vitals strip ── */}
      {(vitals.heartRate || vitals.systolic) && (
        <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
          {vitals.heartRate && (
            <span className="flex items-center gap-1">
              <span className="text-red-400">♥</span>
              {vitals.heartRate} <span className="text-gray-400">bpm</span>
            </span>
          )}
          {vitals.systolic && vitals.diastolic && (
            <span>
              {vitals.systolic}/{vitals.diastolic}
            </span>
          )}
          {vitals.oxygenSaturation && (
            <span>
              SpO₂ {vitals.oxygenSaturation}%
            </span>
          )}
          {vitals.temperature && (
            <span>
              {vitals.temperature}°C
            </span>
          )}
        </div>
      )}

      {/* ── Warning notes ── */}
      {warnings.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {warnings.slice(0, 2).map((note, i) => (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200"
            >
              {note.length > 30 ? note.slice(0, 30) + '…' : note}
            </span>
          ))}
        </div>
      )}

      {/* ── Footer: Wait time + Messages ── */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-100">
        <span className={`text-xs font-semibold ${waitTimeColor(waitMins)}`}>
          ⏱ {formatWaitTime(waitMins)}
        </span>
        <span className="text-[11px] text-gray-400">
          {messages.length > 0 ? `${messages.length} msg${messages.length !== 1 ? 's' : ''}` : 'No messages'}
        </span>
      </div>
    </div>
  );
}
