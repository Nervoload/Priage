// HospitalApp/src/features/admit/TriagePopup.tsx
// Triage form popup modal – placeholder version

import { useState } from 'react';
import type { Encounter } from '../../app/HospitalApp';

interface TriagePopupProps {
    encounter: Encounter;
    onClose: () => void;
    onAdmit?: (encounter: Encounter) => void;
}

// Premade sample triage data
const sampleTriage = {
    painLevel: 6,
    bloodPressure: '138/88',
    heartRate: 92,
    temperature: 38.2,
    oxygenSaturation: 96,
    symptoms: ['Nausea', 'Fatigue', 'Dizziness'],
    notes: 'Patient appears alert and oriented. Mild distress noted.',
};

const allSymptoms = [
    'Nausea', 'Fatigue', 'Dizziness', 'Headache', 'Chest Pain',
    'Shortness of Breath', 'Fever', 'Vomiting', 'Cough', 'Abdominal Pain',
];

export function TriagePopup({ encounter, onClose, onAdmit }: TriagePopupProps) {
    const [painLevel] = useState(sampleTriage.painLevel);

    const getPatientId = (id: number) => `P-${String(id).padStart(3, '0')}`;

    const getPainColor = (level: number) => {
        if (level <= 3) return '#10b981';
        if (level <= 6) return '#eab308';
        return '#ef4444';
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.35rem',
    };

    const valueStyle: React.CSSProperties = {
        fontSize: '1.1rem',
        fontWeight: 600,
        color: '#1f2937',
    };

    const cardStyle: React.CSSProperties = {
        backgroundColor: '#f9fafb',
        borderRadius: '10px',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
    };

    return (
        // Backdrop
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(4px)',
            }}
        >
            {/* Modal */}
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    width: '580px',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                    animation: 'fadeInUp 0.25s ease-out',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1.25rem 1.5rem',
                        borderBottom: '1px solid #e5e7eb',
                        position: 'sticky',
                        top: 0,
                        backgroundColor: 'white',
                        borderRadius: '16px 16px 0 0',
                        zIndex: 1,
                    }}
                >
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1f2937' }}>
                            Triage Assessment
                        </h2>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.15rem' }}>
                            {encounter.patient.displayName} · {getPatientId(encounter.id)}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            color: '#9ca3af',
                            padding: '0.25rem',
                            lineHeight: 1,
                            borderRadius: '6px',
                            transition: 'color 0.15s, background-color 0.15s',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.color = '#1f2937';
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.color = '#9ca3af';
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.5rem' }}>
                    {/* Chief Complaint Banner */}
                    <div
                        style={{
                            backgroundColor: '#fef3c7',
                            border: '1px solid #fcd34d',
                            borderRadius: '10px',
                            padding: '0.85rem 1rem',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                        }}
                    >
                        <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>
                                Chief Complaint
                            </div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#78350f' }}>
                                {encounter.chiefComplaint}
                            </div>
                        </div>
                    </div>

                    {/* Pain Level */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={labelStyle}>Pain Level</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ flex: 1, position: 'relative', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px' }}>
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        height: '100%',
                                        width: `${painLevel * 10}%`,
                                        borderRadius: '4px',
                                        background: `linear-gradient(90deg, #10b981, #eab308, #ef4444)`,
                                        transition: 'width 0.3s',
                                    }}
                                />
                            </div>
                            <span
                                style={{
                                    fontWeight: 700,
                                    fontSize: '1.25rem',
                                    color: getPainColor(painLevel),
                                    minWidth: '2rem',
                                    textAlign: 'center',
                                }}
                            >
                                {painLevel}/10
                            </span>
                        </div>
                    </div>

                    {/* Vitals Grid */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ ...labelStyle, marginBottom: '0.65rem' }}>Vital Signs</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                            <div style={cardStyle}>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Blood Pressure</div>
                                <div style={valueStyle}>{sampleTriage.bloodPressure} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9ca3af' }}>mmHg</span></div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Heart Rate</div>
                                <div style={valueStyle}>{sampleTriage.heartRate} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9ca3af' }}>bpm</span></div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Temperature</div>
                                <div style={valueStyle}>{sampleTriage.temperature}° <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9ca3af' }}>°C</span></div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>O₂ Saturation</div>
                                <div style={valueStyle}>{sampleTriage.oxygenSaturation}<span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9ca3af' }}>%</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Symptoms Checklist */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ ...labelStyle, marginBottom: '0.65rem' }}>Symptoms</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {allSymptoms.map((symptom) => {
                                const isActive = sampleTriage.symptoms.includes(symptom);
                                return (
                                    <span
                                        key={symptom}
                                        style={{
                                            padding: '0.35rem 0.85rem',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: 500,
                                            backgroundColor: isActive ? '#7c3aed15' : '#f3f4f6',
                                            color: isActive ? '#7c3aed' : '#9ca3af',
                                            border: isActive ? '1.5px solid #7c3aed' : '1.5px solid transparent',
                                            cursor: 'default',
                                        }}
                                    >
                                        {isActive && '✓ '}{symptom}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={labelStyle}>Notes</div>
                        <div
                            style={{
                                backgroundColor: '#f9fafb',
                                borderRadius: '10px',
                                padding: '0.85rem 1rem',
                                fontSize: '0.9rem',
                                color: '#374151',
                                lineHeight: 1.6,
                                border: '1px solid #e5e7eb',
                                minHeight: '60px',
                            }}
                        >
                            {sampleTriage.notes}
                        </div>
                    </div>
                </div>

                {/* Footer with Admit button */}
                <div
                    style={{
                        padding: '1rem 1.5rem',
                        borderTop: '1px solid #e5e7eb',
                        position: 'sticky',
                        bottom: 0,
                        backgroundColor: 'white',
                        borderRadius: '0 0 16px 16px',
                    }}
                >
                    <button
                        onClick={() => {
                            // TODO: Implement admit logic
                            onAdmit?.(encounter);
                        }}
                        style={{
                            width: '100%',
                            padding: '0.85rem',
                            backgroundColor: '#7c3aed',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '1rem',
                            transition: 'background-color 0.2s, transform 0.1s',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#6d28d9';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = '#7c3aed';
                        }}
                        onMouseDown={(e) => {
                            e.currentTarget.style.transform = 'scale(0.98)';
                        }}
                        onMouseUp={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        Admit
                    </button>
                </div>
            </div>

            {/* Inline keyframe for the fade-in animation */}
            <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
        </div>
    );
}
