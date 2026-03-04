// PatientApp/src/features/enroute/Enroute.tsx
// Patient "enroute / waiting" view — shown after the encounter is confirmed.
// Displays: encounter status, estimated wait, location sharing, and chat.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Encounter, QueueInfo, PatientSession } from '../../shared/types/domain';
import {
  getMyEncounter,
  getQueueInfo,
  sendLocationPing,
} from '../../shared/api/encounters';
import { MessagePanel } from './MessagePanel';
import { useToast } from '../../shared/ui/ToastContext';

interface EnrouteProps {
  session: PatientSession;
  encounter: Encounter;
  onReset: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  EXPECTED:   { label: 'On the way',        color: '#2563eb', bg: '#eff6ff'  },
  ADMITTED:   { label: 'Arrived — Checked in', color: '#16a34a', bg: '#f0fdf4' },
  TRIAGE:     { label: 'Being assessed',    color: '#d97706', bg: '#fffbeb'  },
  WAITING:    { label: 'In waiting room',    color: '#7c3aed', bg: '#f5f3ff'  },
  COMPLETE:   { label: 'Visit complete',     color: '#059669', bg: '#ecfdf5'  },
  CANCELLED:  { label: 'Cancelled',          color: '#dc2626', bg: '#fef2f2'  },
  UNRESOLVED: { label: 'Visit incomplete',   color: '#dc2626', bg: '#fef2f2'  },
};

export function Enroute({ session, encounter: initialEncounter, onReset }: EnrouteProps) {
  const { showToast } = useToast();
  const [encounter, setEncounter] = useState(initialEncounter);
  const [queue, setQueue] = useState<QueueInfo | null>(null);
  const [locationSharing, setLocationSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const locationWatchRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const encounterId = encounter.id;

  // Poll encounter status every 10s
  const refreshEncounter = useCallback(async () => {
    try {
      const updated = await getMyEncounter(encounterId);
      setEncounter(updated);
    } catch {
      // silent
    }
  }, [encounterId]);

  useEffect(() => {
    refreshEncounter();
    pollRef.current = setInterval(refreshEncounter, 10_000);
    return () => clearInterval(pollRef.current);
  }, [refreshEncounter]);

  // Fetch queue info when status is WAITING or TRIAGE
  useEffect(() => {
    if (encounter.status !== 'WAITING' && encounter.status !== 'TRIAGE') {
      setQueue(null);
      return;
    }

    let cancelled = false;
    async function fetchQueue() {
      try {
        const q = await getQueueInfo(encounterId);
        if (!cancelled) setQueue(q);
      } catch {
        // silent
      }
    }
    fetchQueue();
    const interval = setInterval(fetchQueue, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [encounterId, encounter.status]);

  // Location sharing
  function toggleLocationSharing() {
    if (locationSharing) {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      setLocationSharing(false);
      showToast('Location sharing stopped.', 'info');
      return;
    }

    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await sendLocationPing({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        } catch {
          // silent
        }
      },
      () => {
        showToast('Could not get your location. Please enable GPS.');
        setLocationSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );

    locationWatchRef.current = watchId;
    setLocationSharing(true);
    showToast('Sharing your location with the hospital.', 'success');
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, []);

  const statusInfo = STATUS_LABELS[encounter.status] ?? STATUS_LABELS.EXPECTED;
  const isTerminal = ['COMPLETE', 'CANCELLED', 'UNRESOLVED'].includes(encounter.status);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.logo}>Priage</h1>
        <p style={styles.hospitalName}>
          {session.hospitalSlug ?? 'Hospital'}
        </p>
      </div>

      {/* Status card */}
      <div style={{ ...styles.statusCard, background: statusInfo.bg, borderColor: statusInfo.color }}>
        <div style={{ ...styles.statusDot, background: statusInfo.color }} />
        <div>
          <div style={{ ...styles.statusLabel, color: statusInfo.color }}>
            {statusInfo.label}
          </div>
          {encounter.chiefComplaint && (
            <div style={styles.complaint}>
              {encounter.chiefComplaint}
            </div>
          )}
        </div>
      </div>

      {/* Queue info */}
      {queue && !isTerminal && (
        <div style={styles.queueCard}>
          <div style={styles.queueNumber}>{queue.position}</div>
          <div>
            <div style={styles.queueLabel}>Your position in queue</div>
            <div style={styles.queueWait}>
              ~{queue.estimatedWaitMinutes} min estimated wait
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isTerminal && (
        <div style={styles.actions}>
          {encounter.status === 'EXPECTED' && (
            <button
              style={{
                ...styles.actionBtn,
                background: locationSharing ? '#dc2626' : '#2563eb',
              }}
              onClick={toggleLocationSharing}
            >
              {locationSharing ? '📍 Stop Sharing Location' : '📍 Share My Location'}
            </button>
          )}

          <button
            style={{ ...styles.actionBtn, background: '#1e3a5f' }}
            onClick={() => setShowChat(!showChat)}
          >
            {showChat ? '✕ Close Chat' : '💬 Message ER Staff'}
          </button>
        </div>
      )}

      {/* Chat panel */}
      {showChat && !isTerminal && (
        <div style={styles.chatContainer}>
          <MessagePanel encounterId={encounterId} />
        </div>
      )}

      {/* Terminal status */}
      {isTerminal && (
        <div style={styles.terminalCard}>
          <p style={styles.terminalText}>
            {encounter.status === 'COMPLETE'
              ? 'Your visit is complete. Thank you for using Priage!'
              : 'This encounter has ended.'}
          </p>
          <button style={styles.resetBtn} onClick={onReset}>
            Start New Check-In
          </button>
        </div>
      )}

      {/* Timestamps */}
      <div style={styles.timeline}>
        {encounter.expectedAt && (
          <TimelineItem label="Registered" time={encounter.expectedAt} />
        )}
        {encounter.arrivedAt && (
          <TimelineItem label="Arrived" time={encounter.arrivedAt} />
        )}
        {encounter.triagedAt && (
          <TimelineItem label="Triage started" time={encounter.triagedAt} />
        )}
        {encounter.waitingAt && (
          <TimelineItem label="Moved to waiting" time={encounter.waitingAt} />
        )}
        {encounter.departedAt && (
          <TimelineItem label="Departed" time={encounter.departedAt} />
        )}
      </div>
    </div>
  );
}

function TimelineItem({ label, time }: { label: string; time: string }) {
  return (
    <div style={styles.timelineItem}>
      <div style={styles.timelineDot} />
      <span style={styles.timelineLabel}>{label}</span>
      <span style={styles.timelineTime}>
        {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '1rem',
    maxWidth: '500px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    textAlign: 'center',
    paddingTop: '0.5rem',
  },
  logo: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#1e3a5f',
    margin: 0,
  },
  hospitalName: {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: '0.15rem 0 0',
  },
  statusCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    borderRadius: '14px',
    border: '1px solid',
  },
  statusDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusLabel: {
    fontWeight: 700,
    fontSize: '1rem',
  },
  complaint: {
    fontSize: '0.85rem',
    color: '#475569',
    marginTop: '2px',
  },
  queueCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: '#fff',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
  },
  queueNumber: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#1e3a5f',
    minWidth: '50px',
    textAlign: 'center',
  },
  queueLabel: {
    fontWeight: 600,
    fontSize: '0.9rem',
    color: '#334155',
  },
  queueWait: {
    fontSize: '0.8rem',
    color: '#64748b',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  actionBtn: {
    padding: '0.75rem',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  chatContainer: {
    background: '#fff',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    height: '400px',
    overflow: 'hidden',
    display: 'flex',
  },
  terminalCard: {
    textAlign: 'center',
    padding: '1.5rem',
    background: '#fff',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
  },
  terminalText: {
    fontSize: '0.95rem',
    color: '#334155',
    margin: '0 0 1rem',
  },
  resetBtn: {
    padding: '0.65rem 1.5rem',
    background: '#1e3a5f',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: '#fff',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
  },
  timelineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#3b82f6',
    flexShrink: 0,
  },
  timelineLabel: {
    fontWeight: 600,
    color: '#334155',
    flex: 1,
  },
  timelineTime: {
    color: '#94a3b8',
    fontSize: '0.75rem',
  },
};
