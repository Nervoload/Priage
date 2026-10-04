import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';

import { cancelMyEncounter, getMyEncounter, getQueueInfo, listMyMessages } from '../../shared/api/encounters';
import { API_BASE_URL } from '../../shared/api/client';
import { getMe, updateProfile } from '../../shared/api/auth';
import { sendLocationPing, updateIntakeDetails } from '../../shared/api/intake';
import { encounterPath, encounterStatusMeta, isTerminalEncounter } from '../../shared/encounters';
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
import type { Encounter, EncounterStatus, Hospital, Message, PatientProfile, QueueInfo } from '../../shared/types/domain';
import { Disclosure, LoadingScreen, Modal, StatusPill } from '../../shared/ui/Controls';
import { cx } from '../../shared/ui/cx';
import { TextAreaField, TextField } from '../../shared/ui/Field';
import { Icon } from '../../shared/ui/Icon';
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

function truncate(text: string, length = 90): string {
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

const ED_STEPS = ['Care team notified', 'Check in at the hospital', 'Nurse assessment', 'See a clinician'];

function edStepIndex(status: EncounterStatus): number {
  switch (status) {
    case 'EXPECTED': return 1;
    case 'ADMITTED':
    case 'TRIAGE': return 2;
    case 'WAITING':
    case 'CARE': return 3;
    case 'COMPLETE': return ED_STEPS.length;
    default: return 0;
  }
}

function edStepNote(status: EncounterStatus, queueInfo: QueueInfo | null): string {
  switch (status) {
    case 'EXPECTED': return 'When you arrive';
    case 'ADMITTED': return 'Up next';
    case 'TRIAGE':
    case 'CARE': return 'In progress';
    case 'WAITING': return queueInfo ? `About ${queueInfo.estimatedMinutes} min` : 'Waiting for your turn';
    default: return '';
  }
}

function encounterHeadline(status: EncounterStatus, hospitalName: string, queueInfo: QueueInfo | null): { title: string; lede: string } {
  switch (status) {
    case 'EXPECTED':
      return { title: 'The care team knows you’re coming.', lede: `Your answers are with ${hospitalName}. This page updates as your visit moves along.` };
    case 'ADMITTED':
      return { title: 'You’re checked in.', lede: 'A nurse will assess you next. We’ll keep this page up to date.' };
    case 'TRIAGE':
      return { title: 'A nurse is assessing you.', lede: 'Your care team already has your answers.' };
    case 'CARE':
      return { title: 'You’re with your clinician.', lede: 'Your care team already has your answers.' };
    case 'WAITING':
      return { title: 'You’re in line to be seen.', lede: queueInfo ? 'We’ll keep the estimate below up to date.' : 'We’ll message you here when it’s your turn.' };
    case 'COMPLETE':
      return { title: 'Your visit is complete.', lede: 'Take care. Your messages stay here if you need them.' };
    case 'CANCELLED':
      return { title: 'This visit was cancelled.', lede: 'If you still need care, you can start a new visit.' };
    case 'UNRESOLVED':
      return { title: 'This visit has ended.', lede: 'Contact the hospital if you still need care.' };
    default:
      return { title: 'Your visit is in progress.', lede: `Your answers are with ${hospitalName}.` };
  }
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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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

  const statusMeta = encounterStatusMeta(encounter?.status ?? 'EXPECTED');
  const isTerminal = encounter ? isTerminalEncounter(encounter.status) : false;
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

  // Clinic visits have their own page; this catches links and bookmarks that land here.
  if (encounter?.clinicAlias) {
    return <Navigate to={encounterPath(encounter)} replace />;
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
      showToast('Your details are saved.', 'success');
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

    setCancelling(true);
    try {
      await cancelMyEncounter(encounter.id);
      setCancelOpen(false);
      if (isGuest) {
        clearSession();
        navigate('/welcome', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch {
      showToast('We couldn’t cancel this visit. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  async function handleSendArrivalNote() {
    if (!encounter || arrivalSubmitting || isTerminal) {
      return;
    }

    setArrivalSubmitting(true);
    try {
      const note = transportNote.trim()
        ? `I have arrived at the entrance. Note: ${transportNote.trim()}`
        : 'I have arrived at the entrance and am heading inside now.';
      const sentMessage = await sendPatientMessageReliable(encounter.id, note, false);
      setMessages((previous) => {
        const merged = appendUniqueMessages(previous, [sentMessage]);
        messageCursorRef.current = getLastMessageId(merged);
        return merged;
      });
      showToast('We’ve told the care team you’re here.', 'success');
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
    showToast('Sharing your location with the care team.', 'success');
  }


  if (loading || !encounter) {
    return <LoadingScreen label="Loading your visit…" />;
  }

  const headline = encounterHeadline(encounter.status, hospitalName, queueInfo);
  const currentStep = edStepIndex(encounter.status);
  const latestStaffMessage = recentStaffMessages[0] ?? null;
  const showArrival = encounter.status === 'EXPECTED';

  return (
    <main id="main" className="page">
      <header className="page__header">
        <span className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="building" size={18} />
          {hospitalName}
        </span>
        <h1 className="display">{headline.title}</h1>
        <p className="lede">{headline.lede}</p>
      </header>

      <section className="card card--raised card--pad stack stack--lg" aria-label="Visit status">
        <div className="cluster" style={{ justifyContent: 'space-between' }}>
          <StatusPill tone={statusMeta.tone} dot={statusMeta.dot} pulse={!isTerminal}>{statusMeta.label}</StatusPill>
          <span className="counter">Opened {formatDateTime(encounter.createdAt)}</span>
        </div>

        {queueInfo && (
          <div className="big-time">
            <span className="big-time__day">About {queueInfo.estimatedMinutes} min</span>
            <span className="big-time__meta">
              {queueInfo.position <= 0 ? 'You’re next' : `${queueInfo.position} ${queueInfo.position === 1 ? 'person' : 'people'} ahead of you`}
            </span>
          </div>
        )}

        {latestStaffMessage && (
          <div className="stack stack--xs">
            <span className="row__key">From your care team at {formatShortTime(latestStaffMessage.createdAt)}</span>
            <p className="quote">{latestStaffMessage.content}</p>
          </div>
        )}

        {!isTerminal && (
          <ol className="timeline" aria-label="Visit progress">
            {ED_STEPS.map((label, index) => (
              <li
                key={label}
                className={cx('timeline__item', index < currentStep && 'is-done', index === currentStep && 'is-current')}
                aria-current={index === currentStep ? 'step' : undefined}
              >
                <span className="timeline__rail">
                  <span className="timeline__dot">{index < currentStep && <Icon name="check" size={11} strokeWidth={3} />}</span>
                  <span className="timeline__line" />
                </span>
                <span className="timeline__text">
                  <span>{label}</span>
                  {index === currentStep && <span className="timeline__note">{edStepNote(encounter.status, queueInfo)}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="tiles">
        <Link to={`/messages?encounter=${encounter.id}`} className="tile">
          <span className="tile__icon"><Icon name="message" /></span>
          <span className="heading">Messages</span>
          <span className="small">
            {latestStaffMessage ? truncate(latestStaffMessage.content, 70) : isTerminal ? 'See your message history' : 'Message your care team'}
          </span>
        </Link>
        <HospitalTile hospital={selectedHospital} fallbackName={hospitalName} patientLocation={currentLocation} />
      </div>

      {showArrival && (
        <section className="card" aria-labelledby="arrival-title">
          <div className="card__head">
            <h2 id="arrival-title" className="heading">On your way</h2>
          </div>
          {(selectedHospital?.checkInInstructions || selectedHospital?.parkingNotes) && (
            <div className="rows" style={{ borderBottom: '1px solid var(--line)' }}>
              {selectedHospital?.checkInInstructions && (
                <div className="row"><span className="row__main"><span className="row__key">When you arrive</span><span className="row__value">{selectedHospital.checkInInstructions}</span></span></div>
              )}
              {selectedHospital?.parkingNotes && (
                <div className="row"><span className="row__main"><span className="row__key">Parking and entrance</span><span className="row__value">{selectedHospital.parkingNotes}</span></span></div>
              )}
            </div>
          )}
          <div className="form" style={{ padding: 20 }}>
            <TextAreaField
              label="Note for the care team"
              optional
              rows={2}
              value={transportNote}
              onChange={(event) => setTransportNote(event.target.value)}
              placeholder="For example: parked in lot C, my partner is with me"
              hint="Sent with your “I’m here” message."
            />
            <div className="cluster">
              <button type="button" className="btn btn--primary" onClick={() => void handleSendArrivalNote()} disabled={arrivalSubmitting}>
                <Icon name="mapPin" size={18} />
                {arrivalSubmitting ? 'Sending…' : 'I’m here'}
              </button>
              <button type="button" className="btn btn--secondary" onClick={handleToggleLocationSharing} aria-pressed={locationSharing}>
                {locationSharing ? <span className="status__dot status__dot--pulse" style={{ color: 'var(--green-dot)' }} /> : <Icon name="locate" size={18} />}
                {locationSharing ? 'Stop sharing location' : 'Share my location'}
              </button>
            </div>
            <p className="small">Sharing your location helps the team plan for your arrival. The front desk still checks you in.</p>
          </div>
        </section>
      )}

      {encounter.priageSummary ? (
        <section className="card card--pad" aria-label="Your assessment summary">
          <Disclosure label="Your assessment summary" icon="document">
            <div className="stack stack--sm">
              <p className="body" style={{ color: 'var(--ink)' }}>{encounter.priageSummary.briefing}</p>
              {encounter.priageSummary.recommendedAction && <p className="body">{encounter.priageSummary.recommendedAction}</p>}
              <p className="small">Created from your answers. Your care team reviews it — it isn’t a diagnosis.</p>
            </div>
          </Disclosure>
        </section>
      ) : (encounter.chiefComplaint || encounter.details) && (
        <section className="card" aria-label="What you told us">
          <div className="rows">
            {encounter.chiefComplaint && <div className="row"><span className="row__main"><span className="row__key">Reason for visit</span><span className="row__value">{encounter.chiefComplaint}</span></span></div>}
            {encounter.details && <div className="row"><span className="row__main"><span className="row__key">More details</span><span className="row__value">{encounter.details}</span></span></div>}
          </div>
        </section>
      )}

      {isGuest ? (
        <section className="card" aria-labelledby="guest-details-title">
          <div className="card__head">
            <h2 id="guest-details-title" className="heading">Your details</h2>
          </div>
          <div className="form" style={{ padding: 20 }}>
            <p className="body">Correct anything that’s changed. The care team sees updates right away.</p>
            <div className="field__row">
              <TextField label="First name" value={guestProfile.firstName} onChange={(event) => setGuestProfile((current) => ({ ...current, firstName: event.target.value }))} autoComplete="given-name" />
              <TextField label="Last name" optional value={guestProfile.lastName} onChange={(event) => setGuestProfile((current) => ({ ...current, lastName: event.target.value }))} autoComplete="family-name" />
            </div>
            <div className="field__row">
              <TextField label="Phone" type="tel" value={guestProfile.phone} onChange={(event) => setGuestProfile((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" />
              <TextField label="Age" optional inputMode="numeric" value={guestProfile.age} onChange={(event) => setGuestProfile((current) => ({ ...current, age: event.target.value.replace(/[^\d]/g, '') }))} />
            </div>
            <div className="field__row">
              <TextField label="Gender" optional value={guestProfile.gender} onChange={(event) => setGuestProfile((current) => ({ ...current, gender: event.target.value }))} />
              <TextField label="Preferred language" optional value={guestProfile.preferredLanguage} onChange={(event) => setGuestProfile((current) => ({ ...current, preferredLanguage: event.target.value }))} />
            </div>
            <TextField label="Allergies" optional value={guestProfile.allergies} onChange={(event) => setGuestProfile((current) => ({ ...current, allergies: event.target.value }))} />
            <TextField label="Conditions" optional value={guestProfile.conditions} onChange={(event) => setGuestProfile((current) => ({ ...current, conditions: event.target.value }))} />
            <TextAreaField label="Anything else the care team should know?" optional rows={3} value={guestProfile.details} onChange={(event) => setGuestProfile((current) => ({ ...current, details: event.target.value }))} />
            {guestInfoError && (
              <p className="notice notice--danger" role="alert">
                <Icon name="alertCircle" size={18} />
                <span>{guestInfoError}</span>
              </p>
            )}
            <div>
              <button type="button" className="btn btn--secondary" onClick={() => void handleSaveGuestInfo()} disabled={savingGuestInfo}>
                {savingGuestInfo ? 'Saving…' : 'Save details'}
              </button>
            </div>
          </div>
        </section>
      ) : accountSummary.length > 0 && (
        <section className="card" aria-labelledby="account-details-title">
          <div className="card__head">
            <h2 id="account-details-title" className="heading" style={{ flex: 1 }}>Details on file</h2>
            <Link to="/settings" className="text-btn" style={{ minHeight: 0 }}>Edit</Link>
          </div>
          <div className="detail-grid">
            {accountSummary.map((item) => (
              <div key={item.label} className="row">
                <span className="row__main">
                  <span className="row__key">{item.label}</span>
                  <span className={cx('row__value', item.value === 'Not provided' && 'row__value--empty')}>{item.value}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {isGuest && <UpgradeAccountCard returnTo={`/encounters/${encounter.id}/current`} />}

      {!isTerminal && (
        <div>
          <button type="button" className="text-btn text-btn--danger" onClick={() => setCancelOpen(true)}>
            Cancel this visit
          </button>
        </div>
      )}

      <Modal
        open={cancelOpen}
        title="Cancel this visit?"
        description="We’ll let the care team know you’re no longer coming. If you still need care, you can start a new visit."
        onClose={() => { if (!cancelling) setCancelOpen(false); }}
        dismissible={!cancelling}
      >
        <div className="modal__actions">
          <button type="button" className="btn btn--quiet" onClick={() => setCancelOpen(false)} disabled={cancelling}>Keep my visit</button>
          <button type="button" className="btn btn--danger" onClick={() => void handleCancelVisit()} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel visit'}
          </button>
        </div>
      </Modal>
    </main>
  );
}

function HospitalTile({
  hospital,
  fallbackName,
  patientLocation,
}: {
  hospital: Hospital | null;
  fallbackName: string;
  patientLocation: PatientCoordinates | null;
}) {
  const distance = hospital ? formatHospitalDistance(getHospitalDistanceKm(hospital, patientLocation)) : null;
  return (
    <div className="tile">
      <span className="tile__icon tile__icon--neutral"><Icon name="building" /></span>
      <span className="heading">{hospital?.name ?? fallbackName}</span>
      <span className="small">
        {hospital?.address ?? 'Directions appear once the hospital adds its address.'}
        {distance ? `, ${distance}` : ''}
      </span>
      {hospital && (
        <span className="cluster" style={{ '--cluster-gap': '6px' } as React.CSSProperties}>
          <a className="icon-btn" href={getGoogleMapsDirectionsUrl(hospital, patientLocation)} target="_blank" rel="noreferrer" aria-label="Directions in Google Maps">
            <Icon name="navigation" size={18} />
          </a>
          <a className="icon-btn" href={getAppleMapsDirectionsUrl(hospital, patientLocation)} target="_blank" rel="noreferrer" aria-label="Directions in Apple Maps">
            <Icon name="mapPin" size={18} />
          </a>
          {hospital.phone && (
            <a className="icon-btn" href={`tel:${hospital.phone}`} aria-label={`Call ${hospital.name}`}>
              <Icon name="phone" size={18} />
            </a>
          )}
        </span>
      )}
    </div>
  );
}
