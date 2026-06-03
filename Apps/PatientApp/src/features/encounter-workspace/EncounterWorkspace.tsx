import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';

import { cancelMyEncounter, getMyEncounter, getQueueInfo, listMyMessages } from '../../shared/api/encounters';
import { API_BASE_URL } from '../../shared/api/client';
import { getMe, updateProfile } from '../../shared/api/auth';
import { sendLocationPing, updateIntakeDetails } from '../../shared/api/intake';
import { ENCOUNTER_STATUS_META, isTerminalEncounter } from '../../shared/encounters';
import {
  formatHospitalDistance,
  getAppleMapsDirectionsUrl,
  getGoogleMapsDirectionsUrl,
  getHospitalDistanceKm,
  type PatientCoordinates,
} from '../../shared/hospitalDirectory';
import { useAuth } from '../../shared/hooks/useAuth';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import { useHospitalDirectory } from '../../shared/hooks/useHospitalDirectory';
import { appendUniqueMessages, getLastMessageId } from '../../shared/messages';
import {
  isOutboxQueuedError,
  sendPatientMessageReliable,
} from '../../shared/patientOutbox';
import type { Encounter, Hospital, Message, PatientProfile, QueueInfo } from '../../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../../shared/ui/theme';
import { useToast } from '../../shared/ui/ToastContext';
import { UpgradeAccountCard } from './UpgradeAccountCard';

const ENCOUNTER_FALLBACK_POLL_MS = 60_000;
const MESSAGE_FALLBACK_POLL_MS = 30_000;
const QUEUE_POLL_MS = 60_000;

function formatHospitalName(slug: string | null | undefined): string {
  if (!slug) {
    return 'Priage General Hospital';
  }

  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function toGuestProfileState(profile: PatientProfile) {
  return {
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    phone: profile.phone ?? '',
    age: profile.age != null ? String(profile.age) : '',
    gender: profile.gender ?? '',
    allergies: profile.allergies ?? '',
    conditions: profile.conditions ?? '',
    preferredLanguage: profile.preferredLanguage ?? '',
    details: '',
  };
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Pending';
  }

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLatestCareInstruction(messages: Message[]): string {
  const latest = [...messages].reverse().find((message) => message.senderType === 'USER');
  if (!latest) {
    return 'Your care team will send updates here as your visit progresses.';
  }

  return latest.content;
}

export function EncounterWorkspace() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { session: authSession, patient } = useAuth();
  const { session: guestSession, clearSession } = useGuestSession();
  const { findHospitalById, findHospitalBySlug } = useHospitalDirectory();

  const encounterId = Number(id);
  const isGuest = !authSession && !!guestSession;
  const legacyRedirectTarget =
    encounterId && !Number.isNaN(encounterId)
      ? location.pathname.endsWith('/chat')
        ? `/messages?encounter=${encounterId}`
        : location.pathname.endsWith('/profile')
          ? '/settings'
          : !location.pathname.endsWith('/current')
            ? `/encounters/${encounterId}/current`
            : null
      : null;

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationSharing, setLocationSharing] = useState(false);
  const [arrivalSubmitting, setArrivalSubmitting] = useState(false);
  const [savingGuestInfo, setSavingGuestInfo] = useState(false);
  const [guestInfoError, setGuestInfoError] = useState<string | null>(null);
  const [transportNote, setTransportNote] = useState('');
  const [guestProfile, setGuestProfile] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    age: '',
    gender: '',
    allergies: '',
    conditions: '',
    preferredLanguage: '',
    details: '',
  });
  const [currentLocation, setCurrentLocation] = useState<PatientCoordinates | null>(null);
  const loadedEncounterId = useRef<number | null>(null);
  const messageCursorRef = useRef<number | null>(null);
  const locationWatchRef = useRef<number | null>(null);

  const selectedHospital =
    findHospitalBySlug(guestSession?.hospitalSlug)
    ?? findHospitalById(encounter?.hospitalId ?? null);

  const hospitalName = useMemo(() => {
    if (selectedHospital?.name) {
      return selectedHospital.name;
    }
    if (guestSession?.hospitalSlug) {
      return formatHospitalName(guestSession.hospitalSlug);
    }
    return 'Priage General Hospital';
  }, [guestSession?.hospitalSlug, selectedHospital?.name]);

  const statusMeta = ENCOUNTER_STATUS_META[encounter?.status ?? 'EXPECTED'];
  const isTerminal = encounter ? isTerminalEncounter(encounter.status) : false;
  const latestInstruction = useMemo(() => getLatestCareInstruction(messages), [messages]);
  const recentStaffMessages = useMemo(
    () => messages.filter((message) => message.senderType === 'USER').slice(-3).reverse(),
    [messages],
  );

  const accountSummary = useMemo(() => {
    const source = patient ?? authSession?.patient ?? null;
    if (!source) {
      return [];
    }

    return [
      { label: 'Name', value: [source.firstName, source.lastName].filter(Boolean).join(' ') || 'Not provided' },
      { label: 'Phone', value: source.phone || 'Not provided' },
      { label: 'Allergies', value: source.allergies || 'Not provided' },
      { label: 'Conditions', value: source.conditions || 'Not provided' },
      { label: 'Preferred language', value: source.preferredLanguage || 'Not provided' },
    ];
  }, [authSession?.patient, patient]);

  const handleSessionExpired = useCallback(() => {
    if (isGuest) {
      clearSession();
      navigate('/welcome', { replace: true });
      return;
    }

    navigate('/auth/login', { replace: true });
  }, [clearSession, isGuest, navigate]);

  const refreshEncounter = useCallback(async (showFailureToast = false) => {
    if (!encounterId || Number.isNaN(encounterId)) {
      return;
    }

    try {
      const detail = await getMyEncounter(encounterId);
      setEncounter(detail);
    } catch {
      if (showFailureToast) {
        showToast('Could not load this encounter anymore.');
      }
      handleSessionExpired();
    } finally {
      setLoading(false);
    }
  }, [encounterId, handleSessionExpired, showToast]);

  const refreshMessages = useCallback(async (mode: 'replace' | 'append' = 'replace') => {
    if (!encounterId || Number.isNaN(encounterId)) {
      return;
    }

    try {
      const nextMessages = await listMyMessages(
        encounterId,
        mode === 'append' && messageCursorRef.current != null
          ? { afterMessageId: messageCursorRef.current }
          : {},
      );

      if (mode === 'replace') {
        setMessages(nextMessages);
        messageCursorRef.current = getLastMessageId(nextMessages);
        return;
      }

      if (nextMessages.length === 0) {
        return;
      }

      setMessages((previous) => {
        const merged = appendUniqueMessages(previous, nextMessages);
        messageCursorRef.current = getLastMessageId(merged);
        return merged;
      });
    } catch {
      // Background polling should stay quiet.
    }
  }, [encounterId]);

  useEffect(() => {
    if (!isGuest) {
      return;
    }

    let cancelled = false;

    async function loadGuestProfile() {
      try {
        const profile = await getMe();
        if (cancelled) {
          return;
        }

        setGuestProfile((current) => ({
          ...current,
          ...toGuestProfileState(profile),
        }));
        setGuestInfoError(null);
      } catch {
        if (!cancelled) {
          setGuestInfoError('Could not load your saved guest information.');
        }
      }
    }

    void loadGuestProfile();
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  useEffect(() => {
    if (!encounterId || Number.isNaN(encounterId)) {
      setLoading(false);
      return;
    }

    messageCursorRef.current = null;
    setMessages([]);
    void refreshEncounter(true);
    void refreshMessages('replace');

    const eventSource = typeof EventSource !== 'undefined'
      ? new EventSource(`${API_BASE_URL}/patient/encounters/${encounterId}/events`, {
          withCredentials: true,
        })
      : null;
    const handleEncounterUpdate = () => {
      void refreshEncounter();
    };
    const handleMessageCreated = () => {
      void refreshMessages('append');
    };

    eventSource?.addEventListener('encounter.updated', handleEncounterUpdate);
    eventSource?.addEventListener('message.created', handleMessageCreated);

    const encounterTimer = window.setInterval(() => {
      void refreshEncounter();
    }, ENCOUNTER_FALLBACK_POLL_MS);
    const messageTimer = window.setInterval(() => {
      void refreshMessages('append');
    }, MESSAGE_FALLBACK_POLL_MS);

    return () => {
      eventSource?.close();
      window.clearInterval(encounterTimer);
      window.clearInterval(messageTimer);
    };
  }, [encounterId, refreshEncounter, refreshMessages]);

  useEffect(() => {
    if (!encounter || !['WAITING', 'TRIAGE'].includes(encounter.status)) {
      setQueueInfo(null);
      return;
    }

    const activeEncounterId = encounter.id;
    let cancelled = false;

    async function loadQueue() {
      try {
        const nextQueue = await getQueueInfo(activeEncounterId);
        if (!cancelled) {
          setQueueInfo(nextQueue);
        }
      } catch {
        if (!cancelled) {
          setQueueInfo(null);
        }
      }
    }

    void loadQueue();
    const queueTimer = window.setInterval(() => {
      void loadQueue();
    }, QUEUE_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(queueTimer);
    };
  }, [encounter]);

  useEffect(() => {
    if (!isGuest || !encounter || loadedEncounterId.current === encounter.id) {
      return;
    }

    loadedEncounterId.current = encounter.id;
    setGuestProfile((current) => ({
      ...current,
      details: encounter.details ?? '',
    }));
  }, [encounter, isGuest]);

  useEffect(() => {
    return () => {
      if (locationWatchRef.current != null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, []);

  if (!authSession && !guestSession) {
    return <Navigate to="/welcome" replace />;
  }

  if (!encounterId || Number.isNaN(encounterId)) {
    return <Navigate to={authSession ? '/' : '/welcome'} replace />;
  }

  if (guestSession?.encounterId && guestSession.encounterId !== encounterId) {
    return <Navigate to={`/encounters/${guestSession.encounterId}/current`} replace />;
  }

  if (legacyRedirectTarget) {
    return <Navigate to={legacyRedirectTarget} replace />;
  }

  async function handleSaveGuestInfo() {
    const trimmedFirstName = guestProfile.firstName.trim();
    const trimmedPhone = guestProfile.phone.trim();

    if (!trimmedFirstName) {
      setGuestInfoError('First name is required.');
      return;
    }

    if (!trimmedPhone) {
      setGuestInfoError('Phone number is required.');
      return;
    }

    setSavingGuestInfo(true);
    try {
      const updatedProfile = await updateProfile({
        firstName: trimmedFirstName,
        lastName: guestProfile.lastName.trim() || undefined,
        phone: trimmedPhone,
        age: guestProfile.age ? Number(guestProfile.age) : undefined,
        gender: guestProfile.gender.trim() || undefined,
        allergies: guestProfile.allergies.trim() || undefined,
        conditions: guestProfile.conditions.trim() || undefined,
        preferredLanguage: guestProfile.preferredLanguage.trim() || undefined,
      });

      const updatedEncounter = await updateIntakeDetails({
        details: guestProfile.details.trim() || undefined,
      });

      if (updatedEncounter && typeof updatedEncounter === 'object' && 'id' in updatedEncounter) {
        setEncounter(updatedEncounter as Encounter);
      }

      setGuestProfile({
        ...toGuestProfileState(updatedProfile),
        details: guestProfile.details,
      });
      setGuestInfoError(null);
      showToast('Guest details saved.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save guest information.';
      setGuestInfoError(message);
      showToast(message);
    } finally {
      setSavingGuestInfo(false);
    }
  }

  async function handleCancelVisit() {
    if (!encounter || isTerminal) {
      return;
    }

    try {
      await cancelMyEncounter(encounter.id);
      if (isGuest) {
        clearSession();
        navigate('/welcome', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch {
      showToast('Could not cancel this visit.');
    }
  }

  async function handleSendArrivalNote() {
    if (!encounter || arrivalSubmitting || isTerminal) {
      return;
    }

    setArrivalSubmitting(true);
    try {
      const note = transportNote.trim()
        ? `I have arrived at the hospital entrance. Note: ${transportNote.trim()}`
        : 'I have arrived at the hospital entrance and am heading inside now.';
      const sentMessage = await sendPatientMessageReliable(encounter.id, note, false);
      setMessages((previous) => {
        const merged = appendUniqueMessages(previous, [sentMessage]);
        messageCursorRef.current = getLastMessageId(merged);
        return merged;
      });
      showToast('Arrival update sent to staff.', 'success');
    } catch (error) {
      showToast(
        isOutboxQueuedError(error)
          ? 'Arrival update saved. We will retry when the connection recovers.'
          : 'Could not send arrival update.',
        isOutboxQueuedError(error) ? 'info' : 'error',
      );
    } finally {
      setArrivalSubmitting(false);
    }
  }

  function handleToggleLocationSharing() {
    if (locationSharing) {
      if (locationWatchRef.current != null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      setLocationSharing(false);
      showToast('Location sharing stopped.', 'info');
      return;
    }

    if (!navigator.geolocation) {
      showToast('Location sharing is not supported in this browser.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          await sendLocationPing({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        } catch {
          // Keep background location failures quiet.
        }
      },
      () => {
        setLocationSharing(false);
        showToast('Could not access your location. Enable location permissions to share ETA.');
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );

    locationWatchRef.current = watchId;
    setLocationSharing(true);
    showToast('Sharing your location with the hospital.', 'success');
  }

  if (loading || !encounter) {
    return (
      <div style={styles.loadingShell}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading your encounter dashboard...</p>
      </div>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.heroCard}>
        <div style={styles.heroTop}>
          <span style={styles.badge}>Current Encounter</span>
          {!isTerminal ? (
            <button type="button" style={styles.secondaryButton} onClick={() => void handleCancelVisit()}>
              Cancel visit
            </button>
          ) : null}
        </div>
        <h1 style={styles.title}>{hospitalName}</h1>
        <p style={styles.subtitle}>
          {encounter.status === 'EXPECTED'
            ? 'This is the shared visit dashboard for both guests and account holders while the clinic prepares for your arrival.'
            : 'This encounter dashboard stays aligned for guests and signed-in patients, with only account-specific actions changing.'}
        </p>

        <div style={styles.statusRow}>
          <span style={{ ...styles.statusPill, color: statusMeta.color, background: statusMeta.bg, borderColor: statusMeta.border }}>
            {statusMeta.label}
          </span>
          <span style={styles.timestamp}>Opened {formatDateTime(encounter.createdAt)}</span>
        </div>
      </section>

      <section style={styles.grid}>
        <SupportCard hospital={selectedHospital} fallbackHospitalName={hospitalName} patientLocation={currentLocation} />

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Encounter Summary</h2>
          <div style={styles.summaryGrid}>
            <SummaryItem label="Chief complaint" value={encounter.chiefComplaint || 'Not captured'} />
            <SummaryItem label="Expected arrival" value={formatDateTime(encounter.expectedAt)} />
            <SummaryItem label="Arrived" value={formatDateTime(encounter.arrivedAt)} />
            <SummaryItem
              label="Queue estimate"
              value={queueInfo ? `${queueInfo.estimatedMinutes} min (${queueInfo.position} ahead)` : 'Will appear when the clinic queues this encounter'}
            />
          </div>

          {encounter.priageSummary ? (
            <div style={styles.summaryBlock}>
              <div style={styles.blockEyebrow}>AI briefing</div>
              <p style={styles.bodyText}>{encounter.priageSummary.briefing}</p>
              {encounter.priageSummary.recommendedAction ? (
                <p style={styles.mutedText}>
                  <strong>Recommended next step:</strong> {encounter.priageSummary.recommendedAction}
                </p>
              ) : null}
            </div>
          ) : (
            <p style={styles.bodyText}>{encounter.details || 'No extra encounter details have been added yet.'}</p>
          )}

          <div style={styles.summaryBlock}>
            <div style={styles.blockEyebrow}>Latest care-team instruction</div>
            <p style={styles.bodyText}>{latestInstruction}</p>
          </div>
        </article>

        {isGuest ? (
          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Guest Visit Details</h2>
            <p style={styles.mutedText}>
              This is the same encounter page account holders see, but guests can still complete or correct the details captured during intake.
            </p>
            <div style={styles.formGrid}>
              <Field label="First name *" value={guestProfile.firstName} onChange={(value) => setGuestProfile((current) => ({ ...current, firstName: value }))} />
              <Field label="Last name" value={guestProfile.lastName} onChange={(value) => setGuestProfile((current) => ({ ...current, lastName: value }))} />
              <Field label="Phone number *" value={guestProfile.phone} onChange={(value) => setGuestProfile((current) => ({ ...current, phone: value }))} />
              <Field label="Age" value={guestProfile.age} onChange={(value) => setGuestProfile((current) => ({ ...current, age: value }))} />
              <Field label="Gender" value={guestProfile.gender} onChange={(value) => setGuestProfile((current) => ({ ...current, gender: value }))} />
              <Field label="Preferred language" value={guestProfile.preferredLanguage} onChange={(value) => setGuestProfile((current) => ({ ...current, preferredLanguage: value }))} />
              <Field label="Allergies" value={guestProfile.allergies} onChange={(value) => setGuestProfile((current) => ({ ...current, allergies: value }))} />
              <Field label="Conditions" value={guestProfile.conditions} onChange={(value) => setGuestProfile((current) => ({ ...current, conditions: value }))} />
            </div>
            <Field
              label="Additional details for triage"
              value={guestProfile.details}
              onChange={(value) => setGuestProfile((current) => ({ ...current, details: value }))}
              multiline
              rows={4}
            />
            {guestInfoError ? <p style={styles.errorText}>{guestInfoError}</p> : null}
            <button type="button" style={styles.primaryButton} onClick={() => void handleSaveGuestInfo()} disabled={savingGuestInfo}>
              {savingGuestInfo ? 'Saving...' : 'Save guest details'}
            </button>
          </article>
        ) : (
          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Account Details on File</h2>
            <p style={styles.mutedText}>
              Signed-in patients see the same encounter dashboard, with account editing kept in the dedicated settings page.
            </p>
            <div style={styles.detailStack}>
              {accountSummary.map((item) => (
                <div key={item.label} style={styles.detailRow}>
                  <span style={styles.detailLabel}>{item.label}</span>
                  <span style={styles.detailValue}>{item.value}</span>
                </div>
              ))}
            </div>
            <button type="button" style={styles.secondaryButton} onClick={() => navigate('/settings')}>
              Open Settings
            </button>
          </article>
        )}

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Messages</h2>
          {recentStaffMessages.length === 0 ? (
            <p style={styles.mutedText}>No staff messages yet. Updates will appear here as the encounter progresses.</p>
          ) : (
            <div style={styles.messageStack}>
              {recentStaffMessages.map((message) => (
                <div key={message.id} style={styles.messageRow}>
                  <div style={styles.messageMeta}>
                    <strong>Care team</strong>
                    <span>{formatShortTime(message.createdAt)}</span>
                  </div>
                  <p style={styles.messageBody}>{message.content}</p>
                </div>
              ))}
            </div>
          )}
          <button type="button" style={styles.primaryButton} onClick={() => navigate(`/messages?encounter=${encounter.id}`)}>
            Open full message thread
          </button>
        </article>

        {!isTerminal ? (
          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Location and Arrival</h2>
            <p style={styles.mutedText}>
              Share your ETA with the hospital, or send a quick note when you arrive.
            </p>
            <div style={styles.buttonStack}>
              <button
                type="button"
                style={{ ...styles.primaryButton, background: locationSharing ? '#9f1239' : patientTheme.colors.accent }}
                onClick={handleToggleLocationSharing}
              >
                {locationSharing ? 'Stop sharing location' : 'Share live location'}
              </button>
              <button type="button" style={styles.secondaryButton} onClick={() => void handleSendArrivalNote()} disabled={arrivalSubmitting}>
                {arrivalSubmitting ? 'Sending...' : "I'm here now"}
              </button>
            </div>

            <Field
              label="Transport or arrival note"
              value={transportNote}
              onChange={setTransportNote}
              multiline
              rows={3}
            />
          </article>
        ) : null}

        {isGuest ? <UpgradeAccountCard returnTo={`/encounters/${encounter.id}/current`} /> : null}
      </section>

      <section style={styles.timelineCard}>
        <h2 style={styles.cardTitle}>What Happens Next</h2>
        <ol style={styles.timelineList}>
          <li>Arrival confirmation and registration review.</li>
          <li>Triage or nurse assessment when the team is ready.</li>
          <li>Updates continue here and in the main Messages page for this encounter.</li>
        </ol>
      </section>
    </main>
  );
}

function SupportCard({
  hospital,
  fallbackHospitalName,
  patientLocation,
}: {
  hospital: Hospital | null;
  fallbackHospitalName: string;
  patientLocation: PatientCoordinates | null;
}) {
  if (!hospital) {
    return (
      <article style={styles.card}>
        <h2 style={styles.cardTitle}>Hospital Support</h2>
        <p style={styles.bodyText}>{fallbackHospitalName}</p>
        <p style={styles.mutedText}>Arrival directions and contact details will appear here when the hospital profile is configured.</p>
      </article>
    );
  }

  const distanceLabel = formatHospitalDistance(getHospitalDistanceKm(hospital, patientLocation));

  return (
    <article style={styles.card}>
      <h2 style={styles.cardTitle}>Hospital Support</h2>
      <p style={styles.bodyText}>{hospital.address || hospital.name}</p>
      {distanceLabel ? <p style={styles.mutedText}>{distanceLabel}</p> : null}
      {hospital.checkInInstructions ? (
        <p style={styles.mutedText}>
          <strong>Check-in:</strong> {hospital.checkInInstructions}
        </p>
      ) : null}
      {hospital.parkingNotes ? (
        <p style={styles.mutedText}>
          <strong>Arrival notes:</strong> {hospital.parkingNotes}
        </p>
      ) : null}
      <div style={styles.buttonStack}>
        <a href={getGoogleMapsDirectionsUrl(hospital, patientLocation)} target="_blank" rel="noreferrer" style={styles.linkButton}>
          Google Maps
        </a>
        <a href={getAppleMapsDirectionsUrl(hospital, patientLocation)} target="_blank" rel="noreferrer" style={styles.linkButton}>
          Apple Maps
        </a>
        {hospital.phone ? (
          <a href={`tel:${hospital.phone}`} style={styles.linkButton}>
            Call Hospital
          </a>
        ) : null}
      </div>
    </article>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryItem}>
      <span style={styles.summaryLabel}>{label}</span>
      <span style={styles.summaryValue}>{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <label style={styles.fieldLabel}>
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          style={styles.textArea}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={styles.input}
        />
      )}
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '1rem 1rem 2rem',
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
    maxWidth: '1100px',
    margin: '0 auto 1rem',
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.panel,
    padding: '1rem',
    display: 'grid',
    gap: '0.7rem',
  },
  heroTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.3rem 0.72rem',
    borderRadius: '999px',
    border: panelBorder,
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    fontSize: '0.74rem',
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.6rem',
  },
  subtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.55,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid',
    borderRadius: '999px',
    padding: '0.24rem 0.62rem',
    fontSize: '0.72rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  timestamp: {
    color: patientTheme.colors.inkMuted,
    fontSize: '0.86rem',
  },
  grid: {
    maxWidth: '1100px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
    alignItems: 'start',
  },
  card: {
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.card,
    padding: '1rem',
    display: 'grid',
    gap: '0.75rem',
  },
  cardTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.02rem',
  },
  bodyText: {
    margin: 0,
    lineHeight: 1.55,
    color: patientTheme.colors.ink,
  },
  mutedText: {
    margin: 0,
    lineHeight: 1.55,
    color: patientTheme.colors.inkMuted,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '0.6rem',
  },
  summaryItem: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    padding: '0.8rem',
    display: 'grid',
    gap: '0.2rem',
  },
  summaryLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: patientTheme.colors.inkMuted,
  },
  summaryValue: {
    fontSize: '0.92rem',
    color: patientTheme.colors.ink,
    lineHeight: 1.45,
  },
  summaryBlock: {
    borderTop: panelBorder,
    paddingTop: '0.75rem',
    display: 'grid',
    gap: '0.4rem',
  },
  blockEyebrow: {
    fontSize: '0.76rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: patientTheme.colors.accentStrong,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.65rem',
  },
  fieldLabel: {
    display: 'grid',
    gap: '0.34rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  input: {
    width: '100%',
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.72rem 0.78rem',
    fontSize: '0.94rem',
    fontFamily: patientTheme.fonts.body,
    boxSizing: 'border-box',
  },
  textArea: {
    width: '100%',
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.78rem',
    fontSize: '0.94rem',
    fontFamily: patientTheme.fonts.body,
    lineHeight: 1.5,
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  detailStack: {
    display: 'grid',
    gap: '0.6rem',
  },
  detailRow: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    padding: '0.78rem 0.82rem',
    display: 'grid',
    gap: '0.2rem',
  },
  detailLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: patientTheme.colors.inkMuted,
  },
  detailValue: {
    fontSize: '0.93rem',
    color: patientTheme.colors.ink,
  },
  messageStack: {
    display: 'grid',
    gap: '0.55rem',
  },
  messageRow: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    padding: '0.78rem 0.82rem',
    display: 'grid',
    gap: '0.35rem',
  },
  messageMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.6rem',
    fontSize: '0.78rem',
    color: patientTheme.colors.inkMuted,
  },
  messageBody: {
    margin: 0,
    color: patientTheme.colors.ink,
    lineHeight: 1.5,
  },
  buttonStack: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.6rem',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.78rem 1rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.78rem 1rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  linkButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.78rem 1rem',
    fontWeight: 700,
    textDecoration: 'none',
    fontFamily: patientTheme.fonts.body,
  },
  errorText: {
    margin: 0,
    color: '#b91c1c',
    fontSize: '0.84rem',
  },
  timelineCard: {
    maxWidth: '1100px',
    margin: '1rem auto 0',
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.card,
    padding: '1rem',
    display: 'grid',
    gap: '0.65rem',
  },
  timelineList: {
    margin: 0,
    paddingLeft: '1.2rem',
    color: patientTheme.colors.ink,
    lineHeight: 1.7,
  },
};
