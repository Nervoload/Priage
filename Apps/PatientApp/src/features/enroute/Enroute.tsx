import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { cancelMyEncounter, getMyEncounter, listMyMessages, sendPatientMessage } from '../../shared/api/encounters';
import { sendLocationPing } from '../../shared/api/intake';
import { ENCOUNTER_STATUS_META } from '../../shared/encounters';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import type { Encounter, Message } from '../../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../../shared/ui/theme';
import { useToast } from '../../shared/ui/ToastContext';
import { UpgradeAccountCard } from '../encounter-workspace/UpgradeAccountCard';

const ENCOUNTER_POLL_MS = 10_000;
const MESSAGES_POLL_MS = 5_000;

function formatHospitalName(slug: string | null | undefined): string {
  if (!slug) return 'Priage General Hospital';
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function Enroute() {
  const { encounterId: encounterIdParam } = useParams<{ encounterId: string }>();
  const navigate = useNavigate();
  const { session, clearSession } = useGuestSession();
  const { showToast } = useToast();

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationSharing, setLocationSharing] = useState(false);
  const [arrivalSubmitting, setArrivalSubmitting] = useState(false);
  const [transportNote, setTransportNote] = useState('');
  const locationWatchRef = useRef<number | null>(null);

  const encounterId = Number(encounterIdParam);
  const hospitalName = formatHospitalName(session?.hospitalSlug);
  const statusMeta = ENCOUNTER_STATUS_META[encounter?.status ?? 'EXPECTED'];

  const handleExpired = useCallback(() => {
    clearSession();
    navigate('/welcome', { replace: true });
  }, [clearSession, navigate]);

  const refreshEncounter = useCallback(async (showFailure = false) => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    try {
      const detail = await getMyEncounter(encounterId);
      setEncounter(detail);
      if (detail.status !== 'EXPECTED') {
        navigate(`/encounters/${detail.id}/current`, { replace: true });
      }
    } catch {
      if (showFailure) {
        showToast('Could not load your active visit. Please restart check-in.');
      }
      handleExpired();
    } finally {
      setLoading(false);
    }
  }, [encounterId, handleExpired, navigate, showToast]);

  const refreshMessages = useCallback(async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    try {
      const next = await listMyMessages(encounterId);
      setMessages(next);
    } catch {
      // Keep polling failures silent.
    }
  }, [encounterId]);

  useEffect(() => {
    if (!encounterId || !session) return;

    void refreshEncounter(true);
    void refreshMessages();
    const encounterTimer = setInterval(() => {
      void refreshEncounter();
    }, ENCOUNTER_POLL_MS);
    const messageTimer = setInterval(() => {
      void refreshMessages();
    }, MESSAGES_POLL_MS);

    return () => {
      clearInterval(encounterTimer);
      clearInterval(messageTimer);
    };
  }, [encounterId, refreshEncounter, refreshMessages, session]);

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

  if (!encounterId || Number.isNaN(encounterId)) {
    return <Navigate to="/guest/start" replace />;
  }

  if (session.encounterId && encounterId !== session.encounterId) {
    return <Navigate to={`/guest/enroute/${session.encounterId}`} replace />;
  }

  function saveTransportNote() {
    showToast('Transport note saved.', 'success');
  }

  async function sendArrivalNote() {
    if (!encounter || arrivalSubmitting) return;
    setArrivalSubmitting(true);
    try {
      const note = transportNote.trim()
        ? `I have arrived at the hospital entrance. Note: ${transportNote.trim()}`
        : 'I have arrived at the hospital entrance and am heading inside now.';
      await sendPatientMessage(encounter.id, note, false);
      await refreshMessages();
      showToast('Arrival update sent to staff.', 'success');
    } catch {
      showToast('Could not send arrival update.');
    } finally {
      setArrivalSubmitting(false);
    }
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
      showToast('Geolocation is not supported by this browser.');
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
          // Background failures are intentionally quiet.
        }
      },
      () => {
        setLocationSharing(false);
        showToast('Could not access location. Enable GPS permissions to share ETA.');
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );

    locationWatchRef.current = watchId;
    setLocationSharing(true);
    showToast('Now sharing live location with the hospital.', 'success');
  }

  async function handleCancelVisit() {
    try {
      await cancelMyEncounter(encounterId).catch(() => undefined);
      clearSession();
      navigate('/welcome', { replace: true });
    } catch {
      // handled above
    }
  }

  if (loading || !encounter) {
    return (
      <div style={styles.loadingShell}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading your arrival dashboard...</p>
      </div>
    );
  }

  const recentStaff = messages
    .filter((message) => message.senderType === 'USER')
    .slice(-3)
    .reverse();

  return (
    <main style={styles.page}>
      <section style={styles.heroCard}>
        <div style={styles.heroTop}>
          <span style={styles.badge}>On your way</span>
          <button style={styles.secondaryButton} onClick={handleCancelVisit}>
            Cancel visit
          </button>
        </div>
        <h1 style={styles.title}>{hospitalName}</h1>
        <p style={styles.subtitle}>
          We notified the ER team. This page will automatically move to your full visit workspace once staff admit you.
        </p>

        <div style={styles.statusRow}>
          <span style={{ ...styles.statusPill, color: statusMeta.color, background: statusMeta.bg, borderColor: statusMeta.border }}>
            {statusMeta.label}
          </span>
          <span style={styles.timestamp}>Registered {new Date(encounter.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        </div>
      </section>

      <section style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Complaint summary</h2>
          <p style={styles.bodyText}>{encounter.chiefComplaint ?? 'No complaint entered.'}</p>
          <p style={styles.mutedText}>
            Expected arrival: {encounter.expectedAt ? new Date(encounter.expectedAt).toLocaleString() : 'Pending'}
          </p>
        </article>

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Location and ETA</h2>
          <div style={styles.buttonStack}>
            <button
              style={{ ...styles.primaryButton, background: locationSharing ? '#9f1239' : patientTheme.colors.accent }}
              onClick={toggleLocationSharing}
            >
              {locationSharing ? 'Stop sharing location' : 'Share live location'}
            </button>
            <button style={styles.secondaryButton} onClick={sendArrivalNote} disabled={arrivalSubmitting}>
              {arrivalSubmitting ? 'Sending...' : "I'm here now"}
            </button>
          </div>
        </article>
      </section>

      <section style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Transport notes</h2>
          <textarea
            style={styles.textArea}
            value={transportNote}
            onChange={(event) => setTransportNote(event.target.value)}
            placeholder="Example: parked in lot C, support person waiting at main entrance."
          />
          <button style={styles.secondaryButton} onClick={saveTransportNote}>
            Save note
          </button>
        </article>

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Care-team preview</h2>
          {recentStaff.length === 0 ? (
            <p style={styles.mutedText}>No staff messages yet. Updates will appear here.</p>
          ) : (
            <div style={styles.messageStack}>
              {recentStaff.map((message) => {
                return (
                  <div key={message.id} style={styles.messageRow}>
                    <div style={styles.messageMeta}>
                      <strong>Care Team</strong>
                      <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={styles.messageBody}>{message.content}</p>
                  </div>
                );
              })}
            </div>
          )}
          <button
            style={styles.primaryButton}
            onClick={() => navigate(`/encounters/${encounter.id}/chat`)}
          >
            Open full message thread
          </button>
        </article>
      </section>

      <section style={styles.timelineCard}>
        <h2 style={styles.cardTitle}>What happens next</h2>
        <ol style={styles.timelineList}>
          <li>Arrival confirmation and registration review</li>
          <li>Triage nurse assessment</li>
          <li>Queue placement and ongoing updates in your workspace</li>
        </ol>
      </section>

      <section style={styles.upgradeSection}>
        <UpgradeAccountCard />
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '1rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
  },
  loadingShell: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.8rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
  },
  spinner: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    border: '4px solid #dbe3f3',
    borderTopColor: patientTheme.colors.accent,
    animation: 'spin 0.9s linear infinite',
  },
  loadingText: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
  },
  heroCard: {
    maxWidth: '960px',
    margin: '0 auto 0.8rem',
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.panel,
    padding: '1rem',
    display: 'grid',
    gap: '0.35rem',
  },
  heroTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.55rem',
    flexWrap: 'wrap',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    border: panelBorder,
    borderRadius: '999px',
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.28rem 0.72rem',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.45rem',
  },
  subtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.9rem',
    lineHeight: 1.45,
    maxWidth: '64ch',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '0.35rem',
  },
  statusPill: {
    border: '1px solid',
    borderRadius: '999px',
    padding: '0.24rem 0.62rem',
    fontSize: '0.74rem',
    fontWeight: 700,
  },
  timestamp: {
    color: patientTheme.colors.inkMuted,
    fontSize: '0.8rem',
  },
  grid: {
    maxWidth: '960px',
    margin: '0 auto 0.8rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '0.65rem',
  },
  card: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.card,
    padding: '0.85rem',
    display: 'grid',
    gap: '0.5rem',
  },
  cardTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1rem',
  },
  bodyText: {
    margin: 0,
    lineHeight: 1.45,
    fontSize: '0.9rem',
  },
  mutedText: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.82rem',
    lineHeight: 1.45,
  },
  buttonStack: {
    display: 'grid',
    gap: '0.48rem',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.7rem 0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.68rem 0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  textArea: {
    width: '100%',
    minHeight: '90px',
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.7rem 0.75rem',
    fontSize: '0.9rem',
    fontFamily: patientTheme.fonts.body,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  messageStack: {
    display: 'grid',
    gap: '0.45rem',
  },
  messageRow: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    padding: '0.58rem 0.62rem',
  },
  messageMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    fontSize: '0.75rem',
    color: patientTheme.colors.inkMuted,
    marginBottom: '0.2rem',
  },
  messageBody: {
    margin: 0,
    fontSize: '0.85rem',
    lineHeight: 1.4,
  },
  timelineCard: {
    maxWidth: '960px',
    margin: '0 auto',
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.card,
    padding: '0.85rem',
  },
  timelineList: {
    margin: '0.45rem 0 0',
    paddingLeft: '1.1rem',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.5,
    fontSize: '0.86rem',
  },
  upgradeSection: {
    maxWidth: '960px',
    margin: '0.8rem auto 0',
  },
};
