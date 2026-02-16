// HospitalApp/src/features/triage/TriageForm.tsx
// Inline form for creating a new triage assessment.
// Used inside TriagePopup when no assessment exists yet (or to add a new one).

import { useState } from 'react';
import type { CreateTriagePayload, VitalSigns } from '../../shared/types/domain';
import { createTriageAssessment } from '../../shared/api/triage';

interface TriageFormProps {
  encounterId: number;
  /** Called after a successful submission, with the server's response. */
  onCreated: () => void;
  onCancel: () => void;
}

export function TriageForm({ encounterId, onCreated, onCancel }: TriageFormProps) {
  const [ctasLevel, setCtasLevel] = useState(3);
  const [painLevel, setPainLevel] = useState(0);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [note, setNote] = useState('');

  // Vital signs
  const [bloodPressure, setBloodPressure] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [oxygenSaturation, setOxygenSaturation] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 6.5: Add an "AI Suggest" handler here that calls
  // POST /triage/encounters/:encounterId/suggest and pre-fills ctasLevel,
  // painLevel, and chiefComplaint with the AI response. Display the AI's
  // confidence score and reasoning below the CTAS selector (see Phase 6.5
  // comment near the CTAS buttons). The nurse can accept or override.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        encounterId,
        ctasLevel,
        painLevel,
        chiefComplaint: chiefComplaint || undefined,
        vitalSigns: Object.keys(vitalSigns).length > 0 ? vitalSigns : undefined,
        note: note || undefined,
      };

      await createTriageAssessment(payload);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.35rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '0.65rem 0.85rem',
          marginBottom: '1rem',
          fontSize: '0.8rem',
          color: '#b91c1c',
        }}>
          {error}
        </div>
      )}

      {/* CTAS Level */}
      {/* Phase 6.5: Render an AI suggestion chip here when available, e.g.:
          "AI suggests: CTAS 2 (87% confidence) — [Accept]" 
          Clicking Accept would set ctasLevel and painLevel to the AI values.
          Show the model's reasoning in a small collapsible tooltip. */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>CTAS Level (1–5)</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[1, 2, 3, 4, 5].map(level => (
            <button
              key={level}
              type="button"
              onClick={() => setCtasLevel(level)}
              style={{
                flex: 1,
                padding: '0.6rem',
                border: ctasLevel === level ? '2px solid #7c3aed' : '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: ctasLevel === level ? '#7c3aed10' : 'white',
                color: ctasLevel === level ? '#7c3aed' : '#374151',
                fontWeight: ctasLevel === level ? 700 : 500,
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Pain Level */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>Pain Level: {painLevel}/10</label>
        <input
          type="range"
          min={0}
          max={10}
          value={painLevel}
          onChange={(e) => setPainLevel(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#7c3aed' }}
        />
      </div>

      {/* Chief Complaint */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={labelStyle}>Chief Complaint</label>
        <input
          type="text"
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          placeholder="e.g. Severe abdominal pain"
          maxLength={240}
          style={inputStyle}
        />
      </div>

      {/* Vital Signs */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ ...labelStyle, marginBottom: '0.6rem' }}>Vital Signs</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
          <div>
            <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Blood Pressure</label>
            <input
              type="text"
              value={bloodPressure}
              onChange={(e) => setBloodPressure(e.target.value)}
              placeholder="120/80"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Heart Rate (bpm)</label>
            <input
              type="number"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              placeholder="72"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Temperature (°C)</label>
            <input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="37.0"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, fontSize: '0.65rem' }}>O₂ Saturation (%)</label>
            <input
              type="number"
              value={oxygenSaturation}
              onChange={(e) => setOxygenSaturation(e.target.value)}
              placeholder="98"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, fontSize: '0.65rem' }}>Resp Rate (/min)</label>
            <input
              type="number"
              value={respiratoryRate}
              onChange={(e) => setRespiratoryRate(e.target.value)}
              placeholder="16"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Clinical observations..."
          maxLength={2000}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '0.75rem',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          style={{
            flex: 1,
            padding: '0.75rem',
            backgroundColor: submitting ? '#a78bfa' : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Saving…' : 'Save Assessment'}
        </button>
      </div>
    </form>
  );
}
