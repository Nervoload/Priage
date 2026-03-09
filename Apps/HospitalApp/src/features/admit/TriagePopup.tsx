// HospitalApp/src/features/admit/TriagePopup.tsx
// Triage assessment popup modal – Tailwind-styled using shared Modal.

import { useEffect, useState } from 'react';
import type { Encounter, TriageAssessment, VitalSigns } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { listTriageAssessments } from '../../shared/api/triage';
import { TriageForm } from '../triage/TriageForm';
import { Modal } from '../../shared/ui/Modal';
import { CTASBadge } from '../../shared/ui/Badge';

interface TriagePopupProps {
    encounter: Encounter;
    assessment?: TriageAssessment;
    onClose: () => void;
    onAdmit?: (encounter: Encounter) => void;
}

export function TriagePopup({ encounter, assessment: initialAssessment, onClose, onAdmit }: TriagePopupProps) {
    const [assessment, setAssessment] = useState<TriageAssessment | null>(initialAssessment ?? null);
    const [loading, setLoading] = useState(!initialAssessment);
    const [creating, setCreating] = useState(false);

    const fetchLatest = async () => {
        try {
            const list = await listTriageAssessments(encounter.id);
            if (list.length > 0) setAssessment(list[list.length - 1]);
        } catch { /* silent */ }
    };

    useEffect(() => {
        if (initialAssessment) return;
        let cancelled = false;
        (async () => {
            try {
                const list = await listTriageAssessments(encounter.id);
                if (!cancelled && list.length > 0) setAssessment(list[list.length - 1]);
            } catch { /* silent */ }
            finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [encounter.id, initialAssessment]);

    const vitals: VitalSigns = assessment?.vitalSigns ?? {};
    const painLevel = assessment?.painLevel ?? 0;

    const getPainColor = (level: number) => {
        if (level <= 3) return 'text-green-600';
        if (level <= 6) return 'text-amber-600';
        return 'text-red-600';
    };

    const actionLabel =
        encounter.status === 'EXPECTED' ? 'Confirm Arrival'
        : encounter.status === 'ADMITTED' ? 'Start Triage'
        : encounter.status === 'TRIAGE' ? 'Move to Waiting'
        : encounter.status === 'WAITING' ? 'Discharge'
        : 'Update';

    const title = (
      <div className="flex items-center justify-between w-full">
        <div>
          <div className="text-lg font-bold text-gray-900">
            {creating ? 'New Triage Assessment' : 'Triage Assessment'}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            {patientName(encounter.patient)} · #{encounter.id}
          </div>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="px-3 py-1.5 bg-priage-600 text-white rounded-lg text-xs font-semibold hover:bg-priage-700 transition-colors"
          >
            + New
          </button>
        )}
      </div>
    );

    return (
      <Modal open onClose={onClose} title={title} width="max-w-xl">
        <div className="px-6 py-5">
        {creating ? (
          <TriageForm
            encounterId={encounter.id}
            onCreated={async () => {
              await fetchLatest();
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <div className="space-y-5">
            {/* Chief Complaint Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2.5">
              <span className="text-lg mt-0.5">⚠️</span>
              <div>
                <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Chief Complaint</div>
                <div className="text-sm font-semibold text-amber-900 mt-0.5">
                  {encounter.chiefComplaint ?? 'No complaint recorded'}
                </div>
              </div>
            </div>

            {/* Pain Level */}
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Pain Level</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-400 via-amber-400 to-red-500 transition-all duration-300"
                    style={{ width: `${painLevel * 10}%` }}
                  />
                </div>
                <span className={`font-bold text-lg ${getPainColor(painLevel)} min-w-[2.5rem] text-center`}>
                  {painLevel}/10
                </span>
              </div>
            </div>

            {/* Vitals Grid */}
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Vital Signs</div>
              {loading ? (
                <div className="text-sm text-gray-400">Loading…</div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Blood Pressure', value: vitals.bloodPressure, unit: 'mmHg' },
                    { label: 'Heart Rate', value: vitals.heartRate, unit: 'bpm' },
                    { label: 'Temperature', value: vitals.temperature, unit: '°C' },
                    { label: 'O₂ Saturation', value: vitals.oxygenSaturation, unit: '%' },
                    { label: 'Resp Rate', value: vitals.respiratoryRate, unit: '/min' },
                  ].map((v) => (
                    <div key={v.label} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">{v.label}</div>
                      <div className="text-base font-semibold text-gray-900">
                        {v.value ?? '—'} <span className="text-xs font-normal text-gray-400">{v.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CTAS Level */}
            {assessment && (
              <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">CTAS Level</div>
                <div className="flex items-center gap-2">
                  <CTASBadge level={assessment.ctasLevel as 1|2|3|4|5} />
                  <span className="text-sm text-gray-500">
                    Priority Score: {assessment.priorityScore}
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Notes</div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 leading-relaxed min-h-[60px]">
                {assessment?.note ?? 'No notes recorded.'}
              </div>
            </div>
          </div>
        )}

        {/* Footer action */}
        {onAdmit && !creating && (
          <div className="mt-5 pt-4 border-t border-gray-200">
            <button
              onClick={() => onAdmit(encounter)}
              className="w-full py-3 bg-accent-600 text-white rounded-lg font-semibold hover:bg-accent-700 active:scale-[0.98] transition-all"
            >
              {actionLabel}
            </button>
          </div>
        )}
        </div>
      </Modal>
    );
}
