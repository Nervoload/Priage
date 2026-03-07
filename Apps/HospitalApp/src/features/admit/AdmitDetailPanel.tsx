// HospitalApp/src/features/admit/AdmitDetailPanel.tsx
// Admittance detail side-panel — shows intake info relevant to admittance staff.
// Includes form-completeness check and ability to send reminders to patients.

import { useState } from 'react';
import type { Encounter } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { StatusPill } from '../../shared/ui/StatusPill';
import { checkFormCompleteness, buildReminderMessage } from '../../shared/hooks/formCompleteness';

interface AdmitDetailPanelProps {
  encounter: Encounter;
  onClose: () => void;
  onAdmit: (encounter: Encounter) => void;
  onSendReminder?: (encounter: Encounter, message: string) => Promise<void>;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function AdmitDetailPanel({ encounter, onClose, onAdmit, onSendReminder }: AdmitDetailPanelProps) {
  const name = patientName(encounter.patient);
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const p = encounter.patient;

  const actionLabel =
    encounter.status === 'EXPECTED' ? 'Confirm Arrival'
    : encounter.status === 'ADMITTED' ? 'Start Triage'
    : 'Update';

  // Pre-triage answers from optionalHealthInfo (filled via PatientApp pre-triage flow)
  const healthInfo = p.optionalHealthInfo as Record<string, unknown> | null;

  // Form completeness
  const completeness = checkFormCompleteness(encounter);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const handleSendReminder = async () => {
    if (!onSendReminder) return;
    const message = buildReminderMessage(completeness);
    if (!message) return;

    setSendingReminder(true);
    setReminderError(null);
    try {
      await onSendReminder(encounter, message);
      setReminderSent(true);
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : 'Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-priage-600 text-white flex items-center justify-center text-sm font-bold">
              {initials}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 m-0">{name}</h2>
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <span>#{encounter.id}</span>
                <StatusPill status={encounter.status} />
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

        <div className="px-6 py-5 space-y-5">
          {/* Chief Complaint */}
          <Section title="Chief Complaint">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-amber-900 m-0">
                {encounter.chiefComplaint ?? 'No complaint recorded'}
              </p>
              {encounter.details && (
                <p className="text-xs text-amber-700 mt-1.5 m-0 leading-relaxed">{encounter.details}</p>
              )}
            </div>
          </Section>

          {/* Form Completeness */}
          <Section title="Form Completeness">
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-bold ${
                  completeness.score >= 80 ? 'text-green-700' :
                  completeness.score >= 50 ? 'text-amber-700' : 'text-red-700'
                }`}>
                  {completeness.score}%
                </span>
                <span className="text-xs text-gray-400">
                  {completeness.issues.length === 0 ? 'All fields complete' : `${completeness.issues.length} missing`}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    completeness.score >= 80 ? 'bg-green-500' :
                    completeness.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${completeness.score}%` }}
                />
              </div>
            </div>

            {completeness.issues.length > 0 && (
              <div className="space-y-1 mb-3">
                {completeness.issues.map(issue => (
                  <div key={issue.field} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      issue.severity === 'required' ? 'bg-red-500' : 'bg-amber-400'
                    }`} />
                    <span className="text-gray-600">{issue.label}</span>
                    <span className={`text-[10px] font-semibold uppercase ${
                      issue.severity === 'required' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {issue.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Send reminder button */}
            {completeness.issues.length > 0 && onSendReminder && (
              <div>
                {reminderSent ? (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Reminder sent to patient
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleSendReminder}
                      disabled={sendingReminder}
                      className="w-full py-2 px-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M14 2L7 9M14 2l-5 12-2-5-5-2 12-5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {sendingReminder ? 'Sending…' : 'Send Reminder to Complete Forms'}
                    </button>
                    {reminderError && (
                      <p className="text-xs text-red-600 mt-1 m-0">{reminderError}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </Section>

          {/* Patient Demographics */}
          <Section title="Patient Information">
            <div className="grid grid-cols-2 gap-3">
              <InfoField label="Full Name" value={name} />
              <InfoField label="Age" value={p.age ? `${p.age} years` : 'N/A'} />
              <InfoField label="Gender" value={p.gender ?? 'N/A'} />
              <InfoField label="Phone" value={p.phone ?? 'N/A'} />
              <InfoField label="Language" value={p.preferredLanguage ?? 'English'} />
              <InfoField label="Encounter ID" value={`#${encounter.id}`} />
            </div>
          </Section>

          {/* Medical Alerts */}
          {(p.allergies || p.conditions) && (
            <Section title="Medical Alerts">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                {p.allergies && (
                  <div>
                    <span className="text-[10px] font-bold text-red-700 uppercase tracking-wide">Allergies</span>
                    <p className="text-sm text-red-900 m-0 mt-0.5">{p.allergies}</p>
                  </div>
                )}
                {p.conditions && (
                  <div>
                    <span className="text-[10px] font-bold text-red-700 uppercase tracking-wide">Conditions</span>
                    <p className="text-sm text-red-900 m-0 mt-0.5">{p.conditions}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Pre-Triage Form Answers */}
          {healthInfo && Object.keys(healthInfo).length > 0 && (
            <Section title="Pre-Triage Form Answers">
              <div className="space-y-2">
                {Object.entries(healthInfo).map(([key, value]) => {
                  if (value == null || value === '') return null;
                  const label = key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, s => s.toUpperCase())
                    .trim();
                  return (
                    <div key={key} className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
                      <div className="text-sm text-gray-800 mt-0.5">{String(value)}</div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Timeline */}
          <Section title="Encounter Timeline">
            <div className="space-y-2">
              <TimelineItem label="Created" time={encounter.createdAt} />
              <TimelineItem label="Expected" time={encounter.expectedAt} />
              <TimelineItem label="Arrived" time={encounter.arrivedAt} />
              <TimelineItem label="Triage Started" time={encounter.triagedAt} />
              <TimelineItem label="Waiting" time={encounter.waitingAt} />
            </div>
          </Section>
        </div>

        {/* Sticky footer action */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <button
            onClick={() => onAdmit(encounter)}
            className="w-full py-3 bg-accent-600 text-white rounded-lg font-semibold hover:bg-accent-700 active:scale-[0.98] transition-all cursor-pointer"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      {children}
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

function TimelineItem({ label, time }: { label: string; time: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${time ? 'bg-priage-500' : 'bg-gray-300'}`} />
      <span className="text-xs font-medium text-gray-600 w-28">{label}</span>
      <span className="text-xs text-gray-400">{formatDateTime(time)}</span>
    </div>
  );
}
