// HospitalApp/src/features/waitingroom/PatientDetailModal.tsx
// Expanded patient detail popup with Messages and Patient Profile tabs.

import { useState } from 'react';
import type { Encounter, ChatMessage } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { Modal } from '../../shared/ui/Modal';
import { CTASBadge } from '../../shared/ui/Badge';
import { StatusPill } from '../../shared/ui/StatusPill';
import { ChatPanel } from './ChatPanel';
import { useSimulatedVitals } from '../../shared/hooks/useSimulatedVitals';

type Tab = 'messages' | 'profile';

interface PatientDetailModalProps {
  encounter: Encounter | null;
  messages: ChatMessage[];
  onSendMessage: (encounterId: number, text: string) => Promise<void>;
  onClose: () => void;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getWarnings(encounter: Encounter): string[] {
  const notes: string[] = [];
  const p = encounter.patient;
  if (p?.allergies) notes.push(p.allergies);
  if (p?.conditions) notes.push(p.conditions);
  if (p?.optionalHealthInfo) {
    const info = p.optionalHealthInfo as Record<string, unknown>;
    if (info?.warningNotes) {
      if (Array.isArray(info.warningNotes)) notes.push(...(info.warningNotes as string[]));
    }
  }
  return notes;
}

export function PatientDetailModal({ encounter, messages, onSendMessage, onClose }: PatientDetailModalProps) {
  const [tab, setTab] = useState<Tab>('messages');

  if (!encounter) return null;

  const name = patientName(encounter.patient);
  const latestTriage = encounter.triageAssessments?.[encounter.triageAssessments.length - 1];

  return (
    <Modal open={!!encounter} onClose={onClose} width="max-w-4xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-priage-600 text-white flex items-center justify-center text-lg font-bold">
            {name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900 m-0">{name}</h2>
              <StatusPill status={encounter.status} />
              {encounter.currentCtasLevel && <CTASBadge level={encounter.currentCtasLevel} size="md" />}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">
              #{encounter.id} · {encounter.patient.age ? `${encounter.patient.age}y` : 'Age N/A'}{' '}
              {encounter.patient.gender ? `· ${encounter.patient.gender}` : ''}
              {encounter.patient.phone ? ` · ${encounter.patient.phone}` : ''}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Vitals strip */}
      <VitalStrip encounter={encounter} latestTriage={latestTriage} />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-6">
        <button
          onClick={() => setTab('messages')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            tab === 'messages'
              ? 'border-priage-600 text-priage-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Messages ({messages.length})
        </button>
        <button
          onClick={() => setTab('profile')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            tab === 'profile'
              ? 'border-priage-600 text-priage-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Patient Profile
        </button>
      </div>

      {/* Tab content */}
      <div className="h-[500px] flex flex-col">
        {tab === 'messages' ? (
          <ChatPanel encounter={encounter} messages={messages} onSendMessage={onSendMessage} />
        ) : (
          <PatientProfile encounter={encounter} latestTriage={latestTriage} />
        )}
      </div>
    </Modal>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function VitalStrip({ encounter, latestTriage }: { encounter: Encounter; latestTriage: any }) {
  const vitals = useSimulatedVitals(encounter.id, latestTriage?.vitalSigns);

  if (!vitals.heartRate && !vitals.systolic) return null;

  return (
    <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-6 text-xs">
      {vitals.heartRate && (
        <div className="flex items-center gap-1.5">
          <span className="text-red-400 text-sm">♥</span>
          <span className="font-semibold text-gray-700">{vitals.heartRate}</span>
          <span className="text-gray-400">bpm</span>
        </div>
      )}
      {vitals.systolic && vitals.diastolic && (
        <div className="flex items-center gap-1.5">
          <span className="text-blue-400 text-sm">⬆</span>
          <span className="font-semibold text-gray-700">{vitals.systolic}/{vitals.diastolic}</span>
          <span className="text-gray-400">mmHg</span>
        </div>
      )}
      {vitals.oxygenSaturation && (
        <div className="flex items-center gap-1.5">
          <span className="text-cyan-400 text-sm">○</span>
          <span className="font-semibold text-gray-700">{vitals.oxygenSaturation}%</span>
          <span className="text-gray-400">SpO₂</span>
        </div>
      )}
      {vitals.temperature && (
        <div className="flex items-center gap-1.5">
          <span className="text-orange-400 text-sm">🌡</span>
          <span className="font-semibold text-gray-700">{vitals.temperature}°C</span>
        </div>
      )}
      {vitals.respiratoryRate && (
        <div className="flex items-center gap-1.5">
          <span className="text-teal-400 text-sm">↕</span>
          <span className="font-semibold text-gray-700">{vitals.respiratoryRate}</span>
          <span className="text-gray-400">/min</span>
        </div>
      )}
    </div>
  );
}

function PatientProfile({ encounter, latestTriage }: { encounter: Encounter; latestTriage: any }) {
  const warnings = getWarnings(encounter);
  const vs = latestTriage?.vitalSigns;

  return (
    <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1.5">⚠ Medical Alerts</h4>
          <div className="flex flex-wrap gap-2">
            {warnings.map((w, i) => (
              <span key={i} className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">{w}</span>
            ))}
          </div>
        </div>
      )}

      {/* Patient Info */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Patient Information</h4>
        <div className="grid grid-cols-2 gap-3">
          <InfoField label="Full Name" value={patientName(encounter.patient)} />
          <InfoField label="Age" value={encounter.patient.age ? `${encounter.patient.age} years` : 'N/A'} />
          <InfoField label="Gender" value={encounter.patient.gender ?? 'N/A'} />
          <InfoField label="Phone" value={encounter.patient.phone ?? 'N/A'} />
          <InfoField label="Language" value={(encounter.patient as any).preferredLanguage ?? 'en'} />
          <InfoField label="Encounter ID" value={`#${encounter.id}`} />
        </div>
      </div>

      {/* Chief Complaint */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Chief Complaint</h4>
        <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 m-0">
          {encounter.chiefComplaint || 'No complaint recorded'}
        </p>
        {encounter.details && (
          <p className="text-xs text-gray-500 mt-2 m-0">{encounter.details}</p>
        )}
      </div>

      {/* Triage Assessment */}
      {latestTriage && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Latest Triage Assessment</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <VitalCard label="CTAS Level" value={String(latestTriage.ctasLevel)} />
            <VitalCard label="Pain" value={latestTriage.painLevel != null ? `${latestTriage.painLevel}/10` : 'N/A'} />
            <VitalCard label="Priority" value={String(latestTriage.priorityScore)} />
            <VitalCard label="Assessed" value={new Date(latestTriage.createdAt).toLocaleTimeString()} />
          </div>
          {vs && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-3">
              {vs.bloodPressure && <VitalCard label="Blood Pressure" value={vs.bloodPressure} />}
              {vs.heartRate && <VitalCard label="Heart Rate" value={`${vs.heartRate} bpm`} />}
              {vs.temperature && <VitalCard label="Temperature" value={`${vs.temperature}°C`} />}
              {vs.respiratoryRate && <VitalCard label="Resp. Rate" value={`${vs.respiratoryRate}/min`} />}
              {vs.oxygenSaturation && <VitalCard label="SpO₂" value={`${vs.oxygenSaturation}%`} />}
            </div>
          )}
          {latestTriage.note && (
            <p className="text-xs text-gray-500 mt-2 italic m-0">"{latestTriage.note}"</p>
          )}
        </div>
      )}

      {/* Encounter Timeline */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Encounter Timeline</h4>
        <div className="space-y-2">
          <TimelineItem label="Expected" time={encounter.expectedAt} />
          <TimelineItem label="Arrived" time={encounter.arrivedAt} />
          <TimelineItem label="Triage Started" time={encounter.triagedAt} />
          <TimelineItem label="Waiting" time={encounter.waitingAt} />
          <TimelineItem label="Seen" time={encounter.seenAt} />
          <TimelineItem label="Departed" time={encounter.departedAt} />
        </div>
      </div>

      {/* Decorative action buttons */}
      <div className="flex gap-2 flex-wrap pt-2">
        <button className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed" disabled>
          Order Lab Work
        </button>
        <button className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed" disabled>
          Assign Bed
        </button>
        <button className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed" disabled>
          Transfer Department
        </button>
        <button className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed" disabled>
          Flag for Review
        </button>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium text-gray-800 mt-0.5">{value}</div>
    </div>
  );
}

function VitalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-center">
      <div className="text-[10px] font-semibold text-gray-400 uppercase">{label}</div>
      <div className="text-sm font-bold text-gray-800 mt-0.5">{value}</div>
    </div>
  );
}

function TimelineItem({ label, time }: { label: string; time: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${time ? 'bg-priage-500' : 'bg-gray-300'}`} />
      <span className="text-xs font-medium text-gray-600 w-28">{label}</span>
      <span className="text-xs text-gray-400">{formatTimestamp(time)}</span>
    </div>
  );
}
