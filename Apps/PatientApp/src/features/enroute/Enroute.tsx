import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import type { Encounter, QueueInfo } from '../../shared/types/domain';
import { getMyEncounter, getQueueInfo } from '../../shared/api/encounters';
import { sendLocationPing } from '../../shared/api/intake';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import { useToast } from '../../shared/ui/ToastContext';
import { MessagePanel } from './MessagePanel';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  EXPECTED: { label: 'On the way', color: '#2563eb', bg: '#eff6ff' },
  ADMITTED: { label: 'Checked in', color: '#16a34a', bg: '#f0fdf4' },
  TRIAGE: { label: 'Being assessed', color: '#d97706', bg: '#fffbeb' },
  WAITING: { label: 'In waiting room', color: '#7c3aed', bg: '#f5f3ff' },
  COMPLETE: { label: 'Visit complete', color: '#059669', bg: '#ecfdf5' },
  CANCELLED: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2' },
  UNRESOLVED: { label: 'Visit incomplete', color: '#dc2626', bg: '#fef2f2' },
};

const TERMINAL_STATUSES = ['COMPLETE', 'CANCELLED', 'UNRESOLVED'];

export function Enroute() {
  const { encounterId: encounterIdParam } = useParams<{ encounterId: string }>();
  const navigate = useNavigate();
  const { session, clearSession } = useGuestSession();
  const { showToast } = useToast();

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [queue, setQueue] = useState<QueueInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationSharing, setLocationSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const locationWatchRef = useRef<number | null>(null);

  const encounterId = Number(encounterIdParam);

  const handleExpired = useCallback(() => {
    clearSession();
    navigate('/welcome', { replace: true });
  }, [clearSession, navigate]);

  const refreshEncounter = useCallback(async (suppressErrors = true) => {
    if (!encounterId) return;

    try {
      const updated = await getMyEncounter(encounterId);
      setEncounter(updated);
    } catch {
      if (!suppressErrors) {
        showToast('Could not load your visit. Please start check-in again.');
        handleExpired();
      }
    } finally {
      setLoading(false);
    }
  }, [encounterId, handleExpired, showToast]);

  useEffect(() => {
    if (!encounterId || !session) return;

    let cancelled = false;
    async function loadInitial() {
      try {
        const updated = await getMyEncounter(encounterId);
        if (!cancelled) {
          setEncounter(updated);
        }
      } catch {
        if (!cancelled) {
          showToast('Could not load your visit. Please start check-in again.');
          handleExpired();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitial();
    const interval = setInterval(() => {
      void refreshEncounter();
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [encounterId, handleExpired, refreshEncounter, session, showToast]);

  useEffect(() => {
    if (!encounter || !['WAITING', 'TRIAGE'].includes(encounter.status)) {
      setQueue(null);
      return;
    }

    const activeEncounterId = encounter.id;
    let cancelled = false;
    async function fetchQueue() {
      try {
        const nextQueue = await getQueueInfo(activeEncounterId);
        if (!cancelled) {
          setQueue(nextQueue);
        }
      } catch {
        if (!cancelled) {
          setQueue(null);
        }
      }
    }

    fetchQueue();
    const interval = setInterval(fetchQueue, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [encounter]);

  useEffect(() => {
    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, []);

  if (!session) {
    return <Navigate to="/guest/start" replace />;
  }

  if (!encounterId || (session.encounterId && encounterId !== session.encounterId)) {
    return <Navigate to={session.encounterId ? `/guest/enroute/${session.encounterId}` : '/guest/pre-triage'} replace />;
  }

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
      async (position) => {
        try {
          await sendLocationPing({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        } catch {
          // Keep background location failures silent.
        }
      },
      () => {
        setLocationSharing(false);
        showToast('Could not get your location. Please enable GPS.');
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );

    locationWatchRef.current = watchId;
    setLocationSharing(true);
    showToast('Sharing your location with the hospital.', 'success');
  }

  function handleReset() {
    clearSession();
    navigate('/welcome', { replace: true });
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={styles.loadingText}>Loading your visit…</p>
      </div>
    );
  }

  if (!encounter) {
    return null;
  }

  const statusInfo = STATUS_LABELS[encounter.status] ?? STATUS_LABELS.EXPECTED;
  const isTerminal = TERMINAL_STATUSES.includes(encounter.status);
  const hospitalName = formatHospitalSlug(session.hospitalSlug);
  const queueSummary = queue && queue.totalInQueue > 0
    ? `~${queue.estimatedMinutes} min estimated wait`
    : 'Queue estimate will appear once the hospital has you in line.';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.logo}>Priage</h1>
        <p style={styles.hospitalName}>{hospitalName}</p>
      </div>

      <div style={{ ...styles.statusCard, background: statusInfo.bg, borderColor: statusInfo.color }}>
        <div style={{ ...styles.statusDot, background: statusInfo.color }} />
        <div>
          <div style={{ ...styles.statusLabel, color: statusInfo.color }}>
            {statusInfo.label}
          </div>
          {encounter.chiefComplaint && (
            <div style={styles.complaint}>{encounter.chiefComplaint}</div>
          )}
        </div>
      </div>

      {!isTerminal && queue && (
        <div style={styles.queueCard}>
          <div style={styles.queueNumber}>{queue.position}</div>
          <div>
            <div style={styles.queueLabel}>Your position in queue</div>
            <div style={styles.queueWait}>{queueSummary}</div>
          </div>
        </div>
      )}

      {!isTerminal && (
        <div style={styles.actions}>
          {encounter.status === 'EXPECTED' && (
            <button
              style={{ ...styles.actionBtn, background: locationSharing ? '#dc2626' : '#2563eb' }}
              onClick={toggleLocationSharing}
            >
              {locationSharing ? 'Stop Sharing Location' : 'Share My Location'}
            </button>
          )}

          <button
            style={{ ...styles.actionBtn, background: '#1e3a5f' }}
            onClick={() => setShowChat(prev => !prev)}
          >
            {showChat ? 'Close Chat' : 'Message ER Staff'}
          </button>
        </div>
      )}

      {showChat && !isTerminal && (
        <div style={styles.chatContainer}>
          <MessagePanel encounterId={encounter.id} />
        </div>
      )}

      {isTerminal && (
        <div style={styles.terminalCard}>
          <p style={styles.terminalText}>
            This visit is no longer active. Start a new check-in when you need care again.
          </p>
          <button style={styles.resetBtn} onClick={handleReset}>
            Start New Check-In
          </button>
        </div>
      )}

      <div style={styles.timeline}>
        {encounter.expectedAt && (
          <TimelineItem label="Registered" time={encounter.expectedAt} />
        )}
        {encounter.arrivedAt && (
          <TimelineItem label="Arrived" time={encounter.arrivedAt} />
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

function formatHospitalSlug(hospitalSlug: string | null) {
  if (!hospitalSlug) {
    return 'Hospital selected';
  }

  return hospitalSlug
    .split('-')
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

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
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '0.95rem',
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
    gap: '0.85rem',
    alignItems: 'flex-start',
    border: '1px solid',
    borderRadius: '18px',
    padding: '1rem',
  },
  statusDot: {
    width: '0.75rem',
    height: '0.75rem',
    borderRadius: '999px',
    marginTop: '0.35rem',
    flexShrink: 0,
  },
  statusLabel: {
    fontSize: '0.82rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  complaint: {
    marginTop: '0.35rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#0f172a',
  },
  queueCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '1rem',
    borderRadius: '18px',
    background: '#fff',
    border: '1px solid #e2e8f0',
  },
  queueNumber: {
    minWidth: '3rem',
    height: '3rem',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#e0e7ff',
    color: '#3730a3',
    fontSize: '1.25rem',
    fontWeight: 800,
  },
  queueLabel: {
    fontSize: '0.82rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
  },
  queueWait: {
    marginTop: '0.25rem',
    fontSize: '0.92rem',
    color: '#0f172a',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  actionBtn: {
    padding: '0.9rem 1rem',
    border: 'none',
    borderRadius: '14px',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  chatContainer: {
    background: '#fff',
    borderRadius: '18px',
    border: '1px solid #e2e8f0',
    minHeight: '26rem',
    overflow: 'hidden',
  },
  terminalCard: {
    background: '#fff',
    borderRadius: '18px',
    border: '1px solid #e2e8f0',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
  },
  terminalText: {
    margin: 0,
    color: '#334155',
    lineHeight: 1.5,
  },
  resetBtn: {
    padding: '0.9rem 1rem',
    border: 'none',
    borderRadius: '14px',
    background: '#1e3a5f',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  timeline: {
    marginTop: '0.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    padding: '0.75rem 0 1rem',
  },
  timelineItem: {
    display: 'grid',
    gridTemplateColumns: '12px 1fr auto',
    alignItems: 'center',
    gap: '0.65rem',
  },
  timelineDot: {
    width: '0.65rem',
    height: '0.65rem',
    borderRadius: '999px',
    background: '#94a3b8',
  },
  timelineLabel: {
    color: '#475569',
    fontSize: '0.9rem',
  },
  timelineTime: {
    color: '#94a3b8',
    fontSize: '0.8rem',
    fontVariantNumeric: 'tabular-nums',
  },
};
