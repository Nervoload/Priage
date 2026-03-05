// HospitalApp/src/features/triage/TriageWorkspace.tsx
// Full-page triage workspace that replaces the popup approach.
// Left panel: existing patient info. Right panel: triage assessment form.
// Drafts persist in localStorage until submitted.

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Encounter, VitalSigns, CreateTriagePayload, TriageAssessment } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { createTriageAssessment, listTriageAssessments } from '../../shared/api/triage';
import { moveToWaiting } from '../../shared/api/encounters';
import { CTASBadge } from '../../shared/ui/Badge';
import { StatusPill } from '../../shared/ui/StatusPill';

interface TriageWorkspaceProps {
  encounter: Encounter;
  onClose: () => void;
  onComplete: () => void;
}

// ─── localStorage draft helpers ─────────────────────────────────────────────

interface TriageDraft {
  ctasLevel: number;
  painLevel: number;
  chiefComplaint: string;
  note: string;
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  respiratoryRate: string;
  oxygenSaturation: string;
}

const DRAFT_PREFIX = 'priage_triage_draft_';

function loadDraft(encounterId: number): TriageDraft | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${encounterId}`);
    return raw ? (JSON.parse(raw) as TriageDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(encounterId: number, draft: TriageDraft) {
  try {
    localStorage.setItem(`${DRAFT_PREFIX}${encounterId}`, JSON.stringify(draft));
  } catch { /* quota exceeded — ignore */ }
}

function clearDraft(encounterId: number) {
  localStorage.removeItem(`${DRAFT_PREFIX}${encounterId}`);
}

// ─── Microphone button (UI-only, not implemented) ───────────────────────────

function MicrophoneButton(_props: { onTranscript?: (text: string) => void }) {
  const [recording, setRecording] = useState(false);

  const handleToggle = () => {
    if (recording) {
      setRecording(false);
      // TODO: Stop recording, process audio, call onTranscript with result
    } else {
      setRecording(true);
      // TODO: Start audio recording via MediaRecorder API
      // When complete, send to speech-to-text service and call onTranscript
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={recording ? 'Stop recording' : 'Record voice note'}
      className={`
        w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer
        ${recording
          ? 'bg-red-100 text-red-600 border border-red-300 animate-pulse'
          : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
        }
      `}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="5.5" y="1" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 7.5a5 5 0 0 0 10 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M8 13v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TriageWorkspace({ encounter, onClose, onComplete }: TriageWorkspaceProps) {
  const p = encounter.patient;
  const name = patientName(p);
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Load existing assessments
  const [existingAssessments, setExistingAssessments] = useState<TriageAssessment[]>(
    encounter.triageAssessments ?? [],
  );
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingAssessments(true);
      try {
        const list = await listTriageAssessments(encounter.id);
        if (!cancelled) setExistingAssessments(list);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingAssessments(false); }
    })();
    return () => { cancelled = true; };
  }, [encounter.id]);

  // ─── Form state (loaded from draft or defaults) ───────────────────────

  const draft = loadDraft(encounter.id);

  const [ctasLevel, setCtasLevel] = useState(draft?.ctasLevel ?? 3);
  const [painLevel, setPainLevel] = useState(draft?.painLevel ?? 0);
  const [chiefComplaint, setChiefComplaint] = useState(
    draft?.chiefComplaint ?? encounter.chiefComplaint ?? '',
  );
  const [note, setNote] = useState(draft?.note ?? '');
  const [bloodPressure, setBloodPressure] = useState(draft?.bloodPressure ?? '');
  const [heartRate, setHeartRate] = useState(draft?.heartRate ?? '');
  const [temperature, setTemperature] = useState(draft?.temperature ?? '');
  const [respiratoryRate, setRespiratoryRate] = useState(draft?.respiratoryRate ?? '');
  const [oxygenSaturation, setOxygenSaturation] = useState(draft?.oxygenSaturation ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Auto-save draft on changes ──────────────────────────────────────

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const draftSnapshot = useCallback((): TriageDraft => ({
    ctasLevel, painLevel, chiefComplaint, note,
    bloodPressure, heartRate, temperature, respiratoryRate, oxygenSaturation,
  }), [ctasLevel, painLevel, chiefComplaint, note, bloodPressure, heartRate, temperature, respiratoryRate, oxygenSaturation]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft(encounter.id, draftSnapshot());
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [encounter.id, draftSnapshot]);

  // ─── Submit ──────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const vitalSigns: VitalSigns = {};
      if (bloodPressure) vitalSigns.bloodPressure = bloodPressure;
      if (heartRate) vitalSigns.heartRate = Number(heartRate);
      if (temperature) vitalSigns.temperature = Number(temperature);
      if (respiratoryRate) vitalSigns.respiratoryRate = Number(respiratoryRate);
      if (oxygenSaturation) vitalSigns.oxygenSaturation = Number(oxygenSaturation);

      const payload: CreateTriagePayload = {
        encounterId: encounter.id,
        ctasLevel,
        painLevel,
        chiefComplaint: chiefComplaint || undefined,
        vitalSigns: Object.keys(vitalSigns).length > 0 ? vitalSigns : undefined,
        note: note || undefined,
      };

      await createTriageAssessment(payload);
      await moveToWaiting(encounter.id);
      clearDraft(encounter.id);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete triage');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Medical alerts from patient record ──────────────────────────────

  const warnings: string[] = [];
  if (p.allergies) warnings.push(`Allergies: ${p.allergies}`);
  if (p.conditions) warnings.push(`Conditions: ${p.conditions}`);

  const healthInfo = p.optionalHealthInfo as Record<string, unknown> | null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to list
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-priage-600 text-white flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{name}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                #{encounter.id}
                <StatusPill status={encounter.status} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Draft auto-saved</span>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2.5 bg-priage-600 text-white rounded-lg text-sm font-semibold hover:bg-priage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {submitting ? 'Completing…' : 'Complete Triage & Move to Waiting'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Two-column layout ────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex">
        {/* LEFT: Patient info */}
        <div className="w-[400px] border-r border-gray-200 bg-white overflow-y-auto p-6 space-y-5 shrink-0">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient Information</h3>

          <div className="grid grid-cols-2 gap-2.5">
            <InfoField label="Full Name" value={name} />
            <InfoField label="Age" value={p.age ? `${p.age} years` : 'N/A'} />
            <InfoField label="Gender" value={p.gender ?? 'N/A'} />
            <InfoField label="Phone" value={p.phone ?? 'N/A'} />
            <InfoField label="Language" value={p.preferredLanguage ?? 'English'} />
            <InfoField label="Encounter" value={`#${encounter.id}`} />
          </div>

          {/* Chief Complaint */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Chief Complaint</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-amber-900 m-0">
                {encounter.chiefComplaint ?? 'No complaint recorded'}
              </p>
              {encounter.details && (
                <p className="text-xs text-amber-700 mt-1.5 m-0">{encounter.details}</p>
              )}
            </div>
          </div>

          {/* Medical Alerts */}
          {warnings.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Medical Alerts</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                {warnings.map((w, i) => (
                  <p key={i} className="text-sm text-red-800 m-0 mt-1 first:mt-0">⚠ {w}</p>
                ))}
              </div>
            </div>
          )}

          {/* Pre-Triage Answers */}
          {healthInfo && Object.keys(healthInfo).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pre-Triage Form</h3>
              <div className="space-y-1.5">
                {Object.entries(healthInfo).map(([key, value]) => {
                  if (value == null || value === '') return null;
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
                  return (
                    <div key={key} className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
                      <div className="text-sm text-gray-800 mt-0.5">{String(value)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Previous Assessments */}
          {existingAssessments.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Previous Assessments ({existingAssessments.length})
              </h3>
              <div className="space-y-2">
                {existingAssessments.map((a) => (
                  <div key={a.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <CTASBadge level={a.ctasLevel as 1|2|3|4|5} />
                      <span className="text-[10px] text-gray-400">
                        {new Date(a.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {a.note && <p className="text-xs text-gray-600 m-0">{a.note}</p>}
                    {a.vitalSigns && (
                      <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-gray-500">
                        {a.vitalSigns.heartRate && <span>HR: {a.vitalSigns.heartRate}</span>}
                        {a.vitalSigns.bloodPressure && <span>BP: {a.vitalSigns.bloodPressure}</span>}
                        {a.vitalSigns.temperature && <span>Temp: {a.vitalSigns.temperature}°C</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingAssessments && (
            <p className="text-xs text-gray-400">Loading assessments…</p>
          )}
        </div>

        {/* RIGHT: Triage form */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[640px] mx-auto space-y-6">
            <h3 className="text-lg font-bold text-gray-900 m-0">Triage Assessment</h3>

            {/* CTAS Level */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                CTAS Level (1–5)
              </label>
              <div className="flex gap-2">
                {([1, 2, 3, 4, 5] as const).map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCtasLevel(level)}
                    className={`
                      flex-1 py-3 rounded-lg text-base font-semibold transition-all cursor-pointer
                      ${ctasLevel === level
                        ? 'bg-priage-600 text-white border-2 border-priage-600 shadow-md'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-priage-300'
                      }
                    `}
                  >
                    {level}
                  </button>
                ))}
              </div>
              {ctasLevel && (
                <div className="mt-2 flex items-center gap-2">
                  <CTASBadge level={ctasLevel as 1|2|3|4|5} />
                  <span className="text-xs text-gray-400">
                    {ctasLevel === 1 ? 'Resuscitation' : ctasLevel === 2 ? 'Emergent' : ctasLevel === 3 ? 'Urgent' : ctasLevel === 4 ? 'Less Urgent' : 'Non-Urgent'}
                  </span>
                </div>
              )}
            </div>

            {/* Pain Level */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Pain Level: <span className="text-gray-900 text-sm">{painLevel}/10</span>
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={painLevel}
                onChange={(e) => setPainLevel(Number(e.target.value))}
                className="w-full accent-priage-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>No pain</span>
                <span>Worst possible</span>
              </div>
            </div>

            {/* Chief Complaint (editable) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Chief Complaint (nurse assessment)
              </label>
              <input
                type="text"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="e.g. Severe abdominal pain with nausea"
                maxLength={240}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-priage-300"
              />
            </div>

            {/* Vital Signs */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Vital Signs
              </label>
              <p className="text-xs text-gray-400 mb-3 -mt-1">
                Record values measured during examination. Respiratory rate and O₂ saturation are typically from monitors.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <VitalField
                  label="Blood Pressure"
                  value={bloodPressure}
                  onChange={setBloodPressure}
                  placeholder="120/80"
                  unit="mmHg"
                />
                <VitalField
                  label="Heart Rate"
                  value={heartRate}
                  onChange={setHeartRate}
                  placeholder="72"
                  unit="bpm"
                  type="number"
                />
                <VitalField
                  label="Temperature"
                  value={temperature}
                  onChange={setTemperature}
                  placeholder="37.0"
                  unit="°C"
                  type="number"
                  step="0.1"
                />
                <VitalField
                  label="Respiratory Rate"
                  value={respiratoryRate}
                  onChange={setRespiratoryRate}
                  placeholder="16"
                  unit="/min"
                  type="number"
                  hint="From monitor"
                />
                <VitalField
                  label="O₂ Saturation"
                  value={oxygenSaturation}
                  onChange={setOxygenSaturation}
                  placeholder="98"
                  unit="%"
                  type="number"
                  hint="From pulse oximeter"
                />
              </div>
            </div>

            {/* Notes with microphone */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Triage Notes
                </label>
                <MicrophoneButton />
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Clinical observations, patient presentation, relevant history…"
                rows={5}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white resize-y focus:outline-none focus:ring-2 focus:ring-priage-300"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Use the microphone to dictate notes (coming soon). Draft saves automatically.
              </p>
            </div>

            {/* Submit */}
            <div className="pt-2 border-t border-gray-200">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 mb-4">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-between">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer bg-transparent border-0"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-3 bg-priage-600 text-white rounded-lg font-semibold hover:bg-priage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {submitting ? 'Completing…' : 'Complete Triage & Move to Waiting'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium text-gray-800 mt-0.5">{value}</div>
    </div>
  );
}

function VitalField({
  label, value, onChange, placeholder, unit, type = 'text', step, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  unit: string;
  type?: string;
  step?: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <span className="text-[10px] text-gray-400">{unit}</span>
      </div>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-priage-300"
      />
      {hint && <span className="text-[10px] text-gray-400 mt-0.5 block">{hint}</span>}
    </div>
  );
}
