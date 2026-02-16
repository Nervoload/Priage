// HospitalApp/src/features/admit/TriagePopup.tsx
// Triage assessment popup modal – displays real assessment data from the API.

import { useEffect, useState } from 'react';
import type { Encounter, TriageAssessment, VitalSigns } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { listTriageAssessments } from '../../shared/api/triage';
import { TriageForm } from '../triage/TriageForm';

interface TriagePopupProps {
    encounter: Encounter;
    /** Pass a pre-fetched assessment to skip the API call. */
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

    // Fetch the latest assessment if one wasn't provided via props.
    // TODO: While running against mock data (HospitalApp initialEncounters),
    //       this API call will 404 silently. Once HospitalApp fetches real
    //       encounters from the backend, this will resolve automatically.
    useEffect(() => {
        if (initialAssessment) return;
        let cancelled = false;
        (async () => {
            try {
                const list = await listTriageAssessments(encounter.id);
                if (!cancelled && list.length > 0) {
                    setAssessment(list[list.length - 1]); // latest
                }
            } catch {
                // silent – we'll show "no data" placeholders
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [encounter.id, initialAssessment]);

    const vitals: VitalSigns = assessment?.vitalSigns ?? {};
    const painLevel = assessment?.painLevel ?? 0;

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
                            {creating ? 'New Triage Assessment' : 'Triage Assessment'}
                        </h2>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.15rem' }}>
                            {patientName(encounter.patient)} · #{encounter.id}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {!creating && (
                            <button
                                onClick={() => setCreating(true)}
                                style={{
                                    padding: '0.4rem 0.85rem',
                                    backgroundColor: '#7c3aed',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.8rem',
                                }}
                            >
                                + New
                            </button>
                        )}
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
                </div>

                {/* Body — switches between create form and view mode */}
                <div style={{ padding: '1.5rem' }}>
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
                    <>
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
                                {encounter.chiefComplaint ?? 'No complaint recorded'}
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
                        {loading ? (
                            <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Loading…</div>
                        ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                            <div style={cardStyle}>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Blood Pressure</div>
                                <div style={valueStyle}>{vitals.bloodPressure ?? '—'} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9ca3af' }}>mmHg</span></div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Heart Rate</div>
                                <div style={valueStyle}>{vitals.heartRate ?? '—'} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9ca3af' }}>bpm</span></div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Temperature</div>
                                <div style={valueStyle}>{vitals.temperature ?? '—'} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9ca3af' }}>°C</span></div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>O₂ Saturation</div>
                                <div style={valueStyle}>{vitals.oxygenSaturation ?? '—'}<span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9ca3af' }}>%</span></div>
                            </div>
                        </div>
                        )}
                    </div>

                    {/* CTAS Level (if available) */}
                    {assessment && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ ...labelStyle, marginBottom: '0.65rem' }}>CTAS Level</div>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: '#f9fafb',
                            borderRadius: '10px',
                            padding: '0.6rem 1rem',
                        }}>
                            <span style={{ fontWeight: 700, fontSize: '1.25rem', color: '#7c3aed' }}>
                                {assessment.ctasLevel}
                            </span>
                            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                / 5 — Priority Score: {assessment.priorityScore}
                            </span>
                        </div>
                    </div>
                    )}

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
                        {assessment?.note ?? 'No notes recorded.'}
                        </div>
                    </div>
                    </>
                  )}
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
                        {encounter.status === 'EXPECTED' ? 'Confirm Arrival' : 'Start Triage'}
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
