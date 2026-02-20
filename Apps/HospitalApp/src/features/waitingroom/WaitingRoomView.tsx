// HospitalApp/src/features/waitingroom/WaitingRoomView.tsx
// Waiting Room — two-panel layout: patient list (left) + private chat (right)

import { useState } from 'react';
import type { Encounter, ChatMessage } from '../../app/HospitalApp';
import { patientName } from '../../app/HospitalApp';
import type { TriageAssessment } from '../../shared/types/domain';
import { ChatPanel } from './ChatPanel';
import { AlertDashboard } from './AlertDashboard';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTriageId, setExpandedTriageId] = useState<number | null>(null);
  // TODO (Phase 6.3): Store fetched triage assessments here once connected to backend.
  //   Replace this with data from listTriageAssessments(encounterId) in triage.ts.
  const [triageData] = useState<Record<number, TriageAssessment[]>>({});

  const selectedEncounter = encounters.find(e => e.id === selectedId) ?? null;

  // ─── Search filtering ──────────────────────────────────────────────────
  // TODO (Phase 6.3): Replace client-side filtering with a server-side
  //   GET /patients?search=... query param once the backend supports it.
  //   See FEATURES.md § "Patient Search" for the full integration guide.
  const filteredEncounters = encounters.filter(enc => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = patientName(enc.patient).toLowerCase();
    const id = String(enc.id);
    const complaint = (enc.chiefComplaint ?? '').toLowerCase();
    return name.includes(q) || id.includes(q) || complaint.includes(q);
  });

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

      {/* Alert Dashboard — always visible */}
      <AlertDashboard
        encounters={encounters}
        chatMessages={chatMessages}
        onSelectPatient={(id) => setSelectedId(id)}
      />

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
              width: '420px',
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

            {/* Search bar */}
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ position: 'relative' }}>
                <svg
                  width="14" height="14" viewBox="0 0 16 16" fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
                >
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search patients..."
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.5rem 0.45rem 2rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    outline: 'none',
                    backgroundColor: '#f9fafb',
                    color: '#1f2937',
                    boxSizing: 'border-box',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '0.4rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9ca3af',
                      fontSize: '0.85rem',
                      padding: '0.1rem 0.25rem',
                      lineHeight: 1,
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredEncounters.length === 0 && searchQuery.trim() ? (
                <div style={{
                  padding: '1.5rem 1rem',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: '0.8rem',
                }}>
                  No patients match "{searchQuery}"
                </div>
              ) : null}
              {filteredEncounters.map(encounter => {
                const isSelected = encounter.id === selectedId;
                const unread = getUnreadCount(encounter.id);
                const msgCount = (chatMessages[encounter.id] || []).length;

                return (
                  <div key={encounter.id}>
                    <div
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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
                            {/* Triage expand toggle */}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setExpandedTriageId(prev => prev === encounter.id ? null : encounter.id);
                              }}
                              title="View triage details"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#7c3aed',
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.3rem',
                                borderRadius: '4px',
                                transition: 'background-color 0.15s',
                              }}
                              onMouseOver={e => { e.currentTarget.style.backgroundColor = '#f5f3ff'; }}
                              onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              {expandedTriageId === encounter.id ? '▲' : '▼'}
                            </button>
                          </div>
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

                    {/* ── Triage Dropdown ────────────────────────────────── */}
                    {expandedTriageId === encounter.id && (() => {
                      // TODO (Phase 6.3): Replace this placeholder with real data.
                      //   Call listTriageAssessments(encounter.id) from '../../shared/api/triage'
                      //   and store the result in triageData state. See FEATURES.md § "Triage Dropdown".
                      const assessments: TriageAssessment[] = triageData[encounter.id]
                        ?? encounter.triageAssessments
                        ?? [];
                      const latest = assessments.length > 0 ? assessments[assessments.length - 1] : null;

                      return (
                        <div
                          style={{
                            padding: '0.75rem 1.25rem 0.75rem 3.75rem',
                            backgroundColor: '#faf5ff',
                            borderBottom: '1px solid #e9d5ff',
                          }}
                        >
                          {latest ? (() => {
                            const vs = latest.vitalSigns;
                            return (
                              <div style={{ fontSize: '0.78rem', color: '#374151' }}>
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                                  <span>
                                    <strong>CTAS Level:</strong>{' '}
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '0.05rem 0.4rem',
                                      borderRadius: '4px',
                                      fontWeight: 700,
                                      fontSize: '0.7rem',
                                      backgroundColor:
                                        latest.ctasLevel === 1 ? '#ef4444' :
                                          latest.ctasLevel === 2 ? '#f97316' :
                                            latest.ctasLevel === 3 ? '#eab308' :
                                              latest.ctasLevel === 4 ? '#22c55e' : '#3b82f6',
                                      color: 'white',
                                    }}>
                                      {latest.ctasLevel}
                                    </span>
                                  </span>
                                  {latest.painLevel != null && (
                                    <span><strong>Pain:</strong> {latest.painLevel}/10</span>
                                  )}
                                  <span><strong>Score:</strong> {latest.priorityScore}</span>
                                </div>
                                {latest.chiefComplaint && (
                                  <div style={{ marginBottom: '0.3rem' }}>
                                    <strong>Complaint:</strong> {latest.chiefComplaint}
                                  </div>
                                )}
                                {vs && (
                                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.3rem' }}>
                                    {vs.bloodPressure && <span>BP: {vs.bloodPressure}</span>}
                                    {vs.heartRate && <span>HR: {vs.heartRate}</span>}
                                    {vs.temperature && <span>Temp: {vs.temperature}°C</span>}
                                    {vs.respiratoryRate && <span>RR: {vs.respiratoryRate}</span>}
                                    {vs.oxygenSaturation && <span>SpO₂: {vs.oxygenSaturation}%</span>}
                                  </div>
                                )}
                                {latest.note && (
                                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontStyle: 'italic', marginBottom: '0.3rem' }}>
                                    &quot;{latest.note}&quot;
                                  </div>
                                )}
                                <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>
                                  Assessed {new Date(latest.createdAt).toLocaleString()}
                                  {assessments.length > 1 && ` · ${assessments.length} assessments total`}
                                </div>
                              </div>
                            );
                          })() : (
                            <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' }}>
                              {/* TODO (Phase 6.3): This will show real data once connected to backend */}
                              No triage assessment on file yet.
                            </div>
                          )}

                          {/* View Triage button */}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              // TODO (Phase 6.3): Navigate to full triage detail page/modal.
                              //   Option A: call onNavigate?.('triage') and pass encounter context.
                              //   Option B: open a TriagePopup modal with the encounter.
                              //   For now this is a placeholder that logs to console.
                              console.log('[WaitingRoom] View Triage clicked for encounter', encounter.id);
                            }}
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.35rem 0.85rem',
                              backgroundColor: '#7c3aed',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseOver={e => { e.currentTarget.style.backgroundColor = '#6d28d9'; }}
                            onMouseOut={e => { e.currentTarget.style.backgroundColor = '#7c3aed'; }}
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
                              <path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            View Triage
                          </button>
                        </div>
                      );
                    })()}
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
