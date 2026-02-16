// HospitalApp/src/features/triage/TriageView.tsx
// Triage view with horizontal rows

import { useState } from 'react';
import type { Encounter } from '../../app/HospitalApp';
import { patientName } from '../../app/HospitalApp';
import { TriagePopup } from '../admit/TriagePopup';

interface TriageViewProps {
  onBack?: () => void;
  onNavigate?: (view: 'admit' | 'triage' | 'waiting') => void;
  encounters: Encounter[];
  loading?: boolean;
  onRefresh?: () => void;
}

export function TriageView({ onBack, onNavigate, encounters, loading, onRefresh }: TriageViewProps) {
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const getInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getPriority = (encounter: Encounter): { label: string; color: string } => {
    const complaint = (encounter.chiefComplaint ?? '').toLowerCase();
    if (complaint.includes('critical') || complaint.includes('chest pain') ||
      complaint.includes('difficulty breathing') || complaint.includes('shortness of breath')) {
      return { label: 'CRITICAL', color: '#ef4444' };
    }
    if (complaint.includes('severe') || complaint.includes('high fever') ||
      complaint.includes('high')) {
      return { label: 'HIGH', color: '#f97316' };
    }
    return { label: 'MEDIUM', color: '#eab308' };
  };

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => onBack?.()}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#6b7280',
            }}
          >
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#7c3aed' }}>
            Priage Hospital
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => onNavigate?.('admit')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.25rem' }}>
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M3 14c0-2.5 2.5-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
            Admittance
          </button>
          <button
            onClick={() => onNavigate?.('triage')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: '500',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.25rem' }}>
              <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Triage
          </button>
          <button
            onClick={() => onNavigate?.('waiting')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.25rem' }}>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Waiting Room
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Patient List */}
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.75rem', color: '#1f2937' }}>
            Triage Patients
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                title="Refresh"
                style={{
                  marginLeft: '0.75rem',
                  padding: '0.3rem 0.6rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  fontSize: '1rem',
                  verticalAlign: 'middle',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                ↻
              </button>
            )}
          </h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'white', borderRadius: '12px', color: '#6b7280' }}>
              Loading triage patients…
            </div>
          ) : encounters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'white', borderRadius: '12px' }}>
              No patients in triage
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {encounters.map(encounter => {
                const priority = getPriority(encounter);
                const initials = getInitials(patientName(encounter.patient));

                return (
                  <div
                    key={encounter.id}
                    style={{
                      backgroundColor: 'white',
                      padding: '1.25rem 1.5rem',
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#7c3aed',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '0.875rem',
                      }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1f2937' }}>
                            {patientName(encounter.patient)}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            #{encounter.id}
                          </div>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            backgroundColor: priority.color + '20',
                            color: priority.color,
                          }}>
                            {priority.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {encounter.chiefComplaint ?? 'No complaint recorded'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedEncounter(encounter)}
                      style={{
                        padding: '0.5rem 1.25rem',
                        backgroundColor: '#7c3aed',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '0.875rem',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#6d28d9';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#7c3aed';
                      }}
                    >
                      Get Details
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side - Patient Count */}
        <div style={{ width: '200px' }}>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            position: 'sticky',
            top: '2rem',
          }}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Patients in Triage
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1f2937' }}>
              {encounters.length}
            </div>
          </div>
        </div>
      </div>

      {/* Triage Popup (no Admit button since patient is already in triage) */}
      {selectedEncounter && (
        <TriagePopup
          encounter={selectedEncounter}
          onClose={() => setSelectedEncounter(null)}
        />
      )}

      {/* Footer */}
      <div style={{
        position: 'fixed',
        bottom: '1rem',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 2rem',
        pointerEvents: 'none',
      }}>
        <div style={{
          backgroundColor: '#1f2937',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          pointerEvents: 'auto',
        }}>
          Do not sell or share my personal info
        </div>
        <button
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#1f2937',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            fontWeight: 'bold',
            pointerEvents: 'auto',
          }}
          onClick={() => alert('Help')}
        >
          ?
        </button>
      </div>
    </div>
  );
}
