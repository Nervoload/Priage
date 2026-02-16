// HospitalApp/src/features/waitingroom/WaitingRoomView.tsx
// Waiting Room — two-panel layout: patient list (left) + private chat (right)

import { useState } from 'react';
import type { Encounter, ChatMessage } from '../../app/HospitalApp';
import { patientName } from '../../app/HospitalApp';
import { ChatPanel } from './ChatPanel';

interface WaitingRoomViewProps {
  onBack?: () => void;
  onNavigate?: (view: 'admit' | 'triage' | 'waiting') => void;
  encounters: Encounter[];
  chatMessages: Record<number, ChatMessage[]>;
  onSendMessage: (encounterId: number, text: string) => void;
  loading?: boolean;
  onRefresh?: () => void;
}

export function WaitingRoomView({
  onBack,
  onNavigate,
  encounters,
  chatMessages,
  onSendMessage,
  loading,
  onRefresh,
}: WaitingRoomViewProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedEncounter = encounters.find(e => e.id === selectedId) ?? null;

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getUnreadCount = (encId: number) => {
    // TODO: Replace with real unread logic from backend
    // For now, count patient messages (will always be 0 until backend connected)
    return (chatMessages[encId] || []).filter(m => m.sender === 'patient').length;
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
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Waiting Room
          </button>
        </div>
      </div>

      {/* Two-Panel Layout */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'white', borderRadius: '12px', color: '#6b7280' }}>
          Loading patients…
        </div>
      ) : encounters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'white', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#1f2937', marginBottom: '0.5rem' }}>No patients in waiting room</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Patients will appear here once they are admitted from the Admittance page.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: '1.5rem',
            height: 'calc(100vh - 8rem)',
          }}
        >
          {/* Left Panel — Patient List */}
          <div
            style={{
              width: '320px',
              flexShrink: 0,
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #e5e7eb',
                fontWeight: 600,
                fontSize: '0.95rem',
                color: '#1f2937',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Patients</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={loading}
                    title="Refresh"
                    style={{
                      padding: '0.15rem 0.4rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      backgroundColor: 'white',
                      color: '#6b7280',
                      fontSize: '0.85rem',
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    ↻
                  </button>
                )}
              <span
                style={{
                  backgroundColor: '#7c3aed20',
                  color: '#7c3aed',
                  padding: '0.15rem 0.6rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {encounters.length}
              </span>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {encounters.map(encounter => {
                const isSelected = encounter.id === selectedId;
                const unread = getUnreadCount(encounter.id);
                const msgCount = (chatMessages[encounter.id] || []).length;

                return (
                  <div
                    key={encounter.id}
                    onClick={() => setSelectedId(encounter.id)}
                    style={{
                      padding: '0.85rem 1.25rem',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#f5f3ff' : 'transparent',
                      borderLeft: isSelected ? '3px solid #7c3aed' : '3px solid transparent',
                      borderBottom: '1px solid #f3f4f6',
                      transition: 'background-color 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseOut={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#7c3aed',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(patientName(encounter.patient))}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            color: '#1f2937',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {patientName(encounter.patient)}
                        </div>
                        {unread > 0 && (
                          <span
                            style={{
                              backgroundColor: '#ef4444',
                              color: 'white',
                              borderRadius: '50%',
                              width: '18px',
                              height: '18px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {unread}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        #{encounter.id} · {msgCount > 0 ? `${msgCount} message${msgCount !== 1 ? 's' : ''}` : 'No messages'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel — Chat */}
          <div
            style={{
              flex: 1,
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {selectedEncounter ? (
              <ChatPanel
                encounter={selectedEncounter}
                messages={chatMessages[selectedEncounter.id] || []}
                onSendMessage={onSendMessage}
              />
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9ca3af',
                  gap: '0.75rem',
                }}
              >
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="10" width="36" height="24" rx="4" stroke="#d1d5db" strokeWidth="2" fill="none" />
                  <path d="M6 18l18 10 18-10" stroke="#d1d5db" strokeWidth="2" fill="none" />
                </svg>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>Select a patient to start chatting</div>
                <div style={{ fontSize: '0.8rem' }}>Their private chat will appear here</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
