// HospitalApp/src/features/admit/AdmitView.tsx
// Admittance dashboard view with mock data

import { useState, useMemo } from 'react';
import { TriagePopup } from './TriagePopup';
import type { Encounter } from '../../app/HospitalApp';
import { patientName } from '../../app/HospitalApp';

interface AdmitViewProps {
  onBack?: () => void;
  onNavigate?: (view: 'admit' | 'triage' | 'waiting') => void;
  encounters: Encounter[];
  onAdmit: (encounter: Encounter) => void | Promise<void>;
  loading?: boolean;
  onRefresh?: () => void;
}

export function AdmitView({ onBack, onNavigate, encounters, onAdmit, loading, onRefresh }: AdmitViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All Stages');
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);

  // Filter logic (ready for backend integration)
  const filteredEncounters = useMemo(() => {
    let filtered = encounters;

    // Apply status filter
    if (statusFilter !== 'All Stages') {
      const statusMap: Record<string, Encounter['status']> = {
        'Expected': 'EXPECTED',
        'Admittance': 'ADMITTED',
        'In Triage': 'TRIAGE',
        'Waiting': 'WAITING',
      };
      const status = statusMap[statusFilter];
      if (status) {
        filtered = filtered.filter(e => e.status === status);
      }
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(e =>
        patientName(e.patient).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.chiefComplaint ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(e.id).includes(searchQuery)
      );
    }

    return filtered;
  }, [searchQuery, statusFilter, encounters]);

  const getStatusLabel = (status: Encounter['status']): string => {
    const labels: Record<Encounter['status'], string> = {
      'EXPECTED': 'Expected',
      'ADMITTED': 'Admittance',
      'TRIAGE': 'In Triage',
      'WAITING': 'Waiting',
      'COMPLETE': 'Complete',
      'UNRESOLVED': 'Unresolved',
      'CANCELLED': 'Cancelled',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: Encounter['status']): string => {
    const colors: Record<Encounter['status'], string> = {
      'EXPECTED': '#3b82f6',
      'ADMITTED': '#eab308',
      'TRIAGE': '#f97316',
      'WAITING': '#7c3aed',
      'COMPLETE': '#10b981',
      'UNRESOLVED': '#6b7280',
      'CANCELLED': '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  const getPriority = (encounter: Encounter): { label: string; color: string } => {
    // Priority logic based on keywords in chief complaint
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

  const getInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Calculate summary stats
  const expecting = encounters.filter(e => e.status === 'EXPECTED').length;
  const inAdmittance = encounters.filter(e => e.status === 'ADMITTED').length;
  const totalActive = encounters.filter(e =>
    e.status !== 'COMPLETE' && e.status !== 'CANCELLED'
  ).length;

  // Calculate average wait time for waiting patients
  const waitingPatients = encounters.filter(e => e.status === 'WAITING');
  const avgWaitTime = waitingPatients.length > 0
    ? Math.round(
      waitingPatients.reduce((acc, e) => {
        const waitMs = Date.now() - new Date(e.createdAt).getTime();
        return acc + waitMs;
      }, 0) / waitingPatients.length / 60000
    )
    : 32; // Default to 32m if no waiting patients

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
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M3 14c0-2.5 2.5-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
            Admittance
          </button>
          <button
            onClick={() => onNavigate?.('triage')}
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

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Expecting</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>{expecting}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>In Admittance</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>{inAdmittance}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Total Active</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>{totalActive}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Avg Wait Time</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>{avgWaitTime}m</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 2.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '1rem',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: 'white',
              color: '#000000',
            }}
          />
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="8" cy="8" r="6" stroke="#6b7280" strokeWidth="1.5" fill="none" />
            <path d="m13 13 3 3" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '0.75rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: 'pointer',
            outline: 'none',
            minWidth: '150px',
            backgroundColor: 'white',
            color: '#000000',
          }}
        >
          <option>All Stages</option>
          <option>Expected</option>
          <option>Admittance</option>
          <option>In Triage</option>
          <option>Waiting</option>
        </select>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh encounters"
            style={{
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              backgroundColor: 'white',
              color: '#6b7280',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading ? 0.5 : 1,
            }}
          >
            ↻
          </button>
        )}
      </div>

      {/* Patient Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'white', borderRadius: '12px', color: '#6b7280' }}>
          Loading encounters…
        </div>
      ) : filteredEncounters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'white', borderRadius: '12px' }}>
          No patients found
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.5rem'
        }}>
          {filteredEncounters.map(encounter => {
            const priority = getPriority(encounter);
            const statusColor = getStatusColor(encounter.status);
            const initials = getInitials(patientName(encounter.patient));

            return (
              <div
                key={encounter.id}
                style={{
                  backgroundColor: 'white',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: statusColor,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1f2937' }}>
                      {patientName(encounter.patient)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      #{encounter.id}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: statusColor + '20',
                    color: statusColor,
                  }}>
                    {getStatusLabel(encounter.status)}
                  </span>
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

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                    Chief Complaint
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#1f2937', fontWeight: '500' }}>
                    {encounter.chiefComplaint ?? 'No complaint recorded'}
                  </div>
                </div>

                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Arrived: {formatTime(encounter.createdAt)}
                </div>

                <button
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#6d28d9';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#7c3aed';
                  }}
                  onClick={() => setSelectedEncounter(encounter)}
                >
                  View Details
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedEncounter && (
        <TriagePopup
          encounter={selectedEncounter}
          onClose={() => setSelectedEncounter(null)}
          onAdmit={(enc) => {
            onAdmit(enc);
            setSelectedEncounter(null);
          }}
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
