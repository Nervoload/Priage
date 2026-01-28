// HospitalApp/src/features/waitingroom/WaitingRoomView.tsx
// Waiting Room view placeholder

interface WaitingRoomViewProps {
  onBack?: () => void;
  onNavigate?: (view: 'admit' | 'triage' | 'waiting') => void;
}

export function WaitingRoomView({ onBack, onNavigate }: WaitingRoomViewProps) {
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
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M3 14c0-2.5 2.5-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
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
              <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Triage
          </button>
          <button
            onClick={() => onNavigate?.('waiting')}
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
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Waiting Room
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'white', borderRadius: '12px' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#1f2937', marginBottom: '0.5rem' }}>Waiting Room</h2>
        <p style={{ color: '#6b7280' }}>Waiting Room view coming soon...</p>
      </div>
    </div>
  );
}
