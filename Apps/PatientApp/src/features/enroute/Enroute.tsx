import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { cancelMyEncounter, getMyEncounter, listMyMessages } from '../../shared/api/encounters';
import { getMe, updateProfile } from '../../shared/api/auth';
import { appendUniqueMessages, getLastMessageId } from '../../shared/messages';
import {
  isOutboxQueuedError,
  sendPatientMessageReliable,
} from '../../shared/patientOutbox';
import { sendLocationPing, updateIntakeDetails } from '../../shared/api/intake';
import { ENCOUNTER_STATUS_META } from '../../shared/encounters';
import {
  formatHospitalDistance,
  getAppleMapsDirectionsUrl,
  getGoogleMapsDirectionsUrl,
  getHospitalDistanceKm,
  type PatientCoordinates,
} from '../../shared/hospitalDirectory';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import { useHospitalDirectory } from '../../shared/hooks/useHospitalDirectory';
import type {
  Encounter,
  Hospital,
  HospitalCustomIntakeQuestion,
  Message,
  PatientProfile,
} from '../../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../../shared/ui/theme';
import { useToast } from '../../shared/ui/ToastContext';

const ENCOUNTER_POLL_MS = 10_000;
const MESSAGES_POLL_MS = 5_000;

function formatHospitalName(slug: string | null | undefined): string {
  if (!slug) return 'Priage General Hospital';
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
    allergies: profile.allergies ?? '',
    conditions: profile.conditions ?? '',
    details: '',
  };
}

function toCustomAnswerInputValue(value: unknown, responseType: HospitalCustomIntakeQuestion['responseType']): string {
  if (value == null) {
    return '';
  }

  if (responseType === 'boolean') {
    return value === true ? 'yes' : value === false ? 'no' : '';
  }

  if (responseType === 'number') {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  }

  return typeof value === 'string' ? value : '';
}

function serializeCustomQuestionAnswers(
  answers: Record<string, string>,
  questions: HospitalCustomIntakeQuestion[],
): Record<string, string | number | boolean | null> | undefined {
  const payload: Record<string, string | number | boolean | null> = {};

  for (const question of questions) {
    const rawValue = answers[question.fieldKey] ?? '';
    const trimmedValue = rawValue.trim();

    switch (question.responseType) {
      case 'boolean':
        payload[question.fieldKey] =
          rawValue === 'yes' ? true : rawValue === 'no' ? false : null;
        break;
      case 'number':
        payload[question.fieldKey] = trimmedValue && Number.isFinite(Number(trimmedValue))
          ? Number(trimmedValue)
          : null;
        break;
      case 'textarea':
      case 'text':
      case 'select':
      default:
        payload[question.fieldKey] = trimmedValue || null;
        break;
    }
  }

  return Object.keys(payload).length > 0 ? payload : undefined;
}

export function Enroute() {
  const { encounterId: encounterIdParam } = useParams<{ encounterId: string }>();
  const navigate = useNavigate();
  const { session, clearSession } = useGuestSession();
  const { showToast } = useToast();
  const { findHospitalById, findHospitalBySlug } = useHospitalDirectory();

  const [encounter, setEncounter] = useState<Encounter | null>(null);
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
    allergies: '',
    conditions: '',
    details: '',
  });
  const [savedHealthInfo, setSavedHealthInfo] = useState<Record<string, unknown> | null>(null);
  const [customQuestionAnswers, setCustomQuestionAnswers] = useState<Record<string, string>>({});
  const [currentLocation, setCurrentLocation] = useState<PatientCoordinates | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const loadedEncounterId = useRef<number | null>(null);
  const messageCursorRef = useRef<number | null>(null);

  const encounterId = Number(encounterIdParam);
  const fallbackHospitalName = formatHospitalName(session?.hospitalSlug);
  const statusMeta = ENCOUNTER_STATUS_META[encounter?.status ?? 'EXPECTED'];
  const selectedHospital =
    findHospitalBySlug(session?.hospitalSlug)
    ?? findHospitalById(encounter?.hospitalId ?? null);
  const applicableCustomQuestions = (selectedHospital?.customIntakeQuestions ?? []).filter(
    (question) => question.appliesTo !== 'triage',
  );
  const hospitalName = selectedHospital?.name ?? fallbackHospitalName;

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

  const refreshMessages = useCallback(async (mode: 'replace' | 'append' = 'replace') => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    try {
      const next = await listMyMessages(
        encounterId,
        mode === 'append' ? { afterMessageId: messageCursorRef.current ?? 0 } : {},
      );

      if (mode === 'replace') {
        setMessages(next);
        messageCursorRef.current = getLastMessageId(next);
        return;
      }

      if (next.length === 0) {
        return;
      }

      setMessages((prev) => {
        const merged = appendUniqueMessages(prev, next);
        messageCursorRef.current = getLastMessageId(merged);
        return merged;
      });
    } catch {
      // Keep polling failures silent.
    }
  }, [encounterId]);

  useEffect(() => {
    if (!encounterId || !session) return;

    messageCursorRef.current = null;
    setMessages([]);
    void refreshEncounter(true);
    void refreshMessages('replace');
    const encounterTimer = setInterval(() => {
      void refreshEncounter();
    }, ENCOUNTER_POLL_MS);
    const messageTimer = setInterval(() => {
      void refreshMessages('append');
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

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    async function loadGuestProfile() {
      try {
        const profile = await getMe();
        if (cancelled) return;
        setGuestProfile((prev) => ({
          ...prev,
          ...toGuestProfileState(profile),
        }));
        setSavedHealthInfo((profile.optionalHealthInfo as Record<string, unknown> | null) ?? null);
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
  }, [session]);

  useEffect(() => {
    if (!encounter || loadedEncounterId.current === encounter.id) {
      return;
    }

    loadedEncounterId.current = encounter.id;
    setGuestProfile((prev) => ({
      ...prev,
      details: encounter.details ?? '',
    }));
  }, [encounter]);

  useEffect(() => {
    if (applicableCustomQuestions.length === 0) {
      setCustomQuestionAnswers({});
      return;
    }

    setCustomQuestionAnswers((previous) => {
      const nextAnswers: Record<string, string> = {};
      for (const question of applicableCustomQuestions) {
        nextAnswers[question.fieldKey] = previous[question.fieldKey]
          ?? toCustomAnswerInputValue(savedHealthInfo?.[question.fieldKey], question.responseType);
      }
      return nextAnswers;
    });
  }, [applicableCustomQuestions, savedHealthInfo]);

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
      await updateProfile({
        firstName: trimmedFirstName,
        lastName: guestProfile.lastName.trim() || undefined,
        phone: trimmedPhone,
        age: guestProfile.age ? Number(guestProfile.age) : undefined,
        allergies: guestProfile.allergies.trim() || undefined,
        conditions: guestProfile.conditions.trim() || undefined,
      });

      const result = await updateIntakeDetails({
        details: guestProfile.details.trim() || undefined,
        customQuestionAnswers: serializeCustomQuestionAnswers(customQuestionAnswers, applicableCustomQuestions),
      });

      if (result && typeof result === 'object' && 'id' in result) {
        setEncounter(result as Encounter);
      }

      setSavedHealthInfo((previous) => {
        const next = { ...(previous ?? {}) };
        const serialized = serializeCustomQuestionAnswers(customQuestionAnswers, applicableCustomQuestions) ?? {};
        for (const question of applicableCustomQuestions) {
          const nextValue = serialized[question.fieldKey];
          if (nextValue == null || nextValue === '') {
            delete next[question.fieldKey];
          } else {
            next[question.fieldKey] = nextValue;
          }
        }
        return next;
      });

      setGuestInfoError(null);
      showToast('Guest information saved.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save guest information.';
      setGuestInfoError(message);
      showToast(message);
    } finally {
      setSavingGuestInfo(false);
    }
  }

  async function sendArrivalNote() {
    if (!encounter || arrivalSubmitting) return;
    setArrivalSubmitting(true);
    try {
      const note = transportNote.trim()
        ? `I have arrived at the hospital entrance. Note: ${transportNote.trim()}`
        : 'I have arrived at the hospital entrance and am heading inside now.';
      const sentMessage = await sendPatientMessageReliable(encounter.id, note, false);
      setMessages((prev) => {
        const merged = appendUniqueMessages(prev, [sentMessage]);
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
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
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
        {selectedHospital && (
          <HospitalArrivalCard hospital={selectedHospital} patientLocation={currentLocation} />
        )}

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Complete your info</h2>
          <p style={styles.mutedText}>
            You are checked in already. Add anything else that could help the triage team before you arrive.
          </p>
          <div style={styles.formGrid}>
            <label style={styles.fieldLabel}>
              First name *
              <input
                style={styles.input}
                value={guestProfile.firstName}
                onChange={(event) => setGuestProfile((prev) => ({ ...prev, firstName: event.target.value }))}
              />
            </label>
            <label style={styles.fieldLabel}>
              Last name
              <input
                style={styles.input}
                value={guestProfile.lastName}
                onChange={(event) => setGuestProfile((prev) => ({ ...prev, lastName: event.target.value }))}
              />
            </label>
            <label style={styles.fieldLabel}>
              Phone number *
              <input
                style={styles.input}
                value={guestProfile.phone}
                onChange={(event) => setGuestProfile((prev) => ({ ...prev, phone: event.target.value }))}
                inputMode="tel"
              />
            </label>
            <label style={styles.fieldLabel}>
              Age
              <input
                style={styles.input}
                value={guestProfile.age}
                onChange={(event) => setGuestProfile((prev) => ({ ...prev, age: event.target.value }))}
                inputMode="numeric"
              />
            </label>
            <label style={styles.fieldLabel}>
              Allergies
              <input
                style={styles.input}
                value={guestProfile.allergies}
                onChange={(event) => setGuestProfile((prev) => ({ ...prev, allergies: event.target.value }))}
              />
            </label>
            <label style={styles.fieldLabel}>
              Conditions
              <input
                style={styles.input}
                value={guestProfile.conditions}
                onChange={(event) => setGuestProfile((prev) => ({ ...prev, conditions: event.target.value }))}
              />
            </label>
          </div>
          <label style={styles.fieldLabel}>
            Additional details for triage
            <textarea
              style={styles.textArea}
              value={guestProfile.details}
              onChange={(event) => setGuestProfile((prev) => ({ ...prev, details: event.target.value }))}
              placeholder="Symptoms started 90 minutes ago, took aspirin at home, pain is getting worse..."
            />
          </label>
          {applicableCustomQuestions.length > 0 && (
            <div style={styles.customQuestionSection}>
              <h3 style={styles.customQuestionTitle}>Hospital intake questions</h3>
              <p style={styles.mutedText}>
                These questions come from {hospitalName} and help the admittance team review your chart before you arrive.
              </p>
              <div style={styles.customQuestionGrid}>
                {applicableCustomQuestions.map((question) => (
                  <label key={question.id} style={styles.fieldLabel}>
                    {question.label}
                    {question.required ? ' *' : ''}
                    {question.responseType === 'textarea' ? (
                      <textarea
                        style={styles.textArea}
                        value={customQuestionAnswers[question.fieldKey] ?? ''}
                        onChange={(event) => setCustomQuestionAnswers((prev) => ({
                          ...prev,
                          [question.fieldKey]: event.target.value,
                        }))}
                        placeholder={question.helpText || undefined}
                      />
                    ) : question.responseType === 'boolean' ? (
                      <select
                        style={styles.input}
                        value={customQuestionAnswers[question.fieldKey] ?? ''}
                        onChange={(event) => setCustomQuestionAnswers((prev) => ({
                          ...prev,
                          [question.fieldKey]: event.target.value,
                        }))}
                      >
                        <option value="">Select one</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : (
                      <input
                        style={styles.input}
                        type={question.responseType === 'number' ? 'number' : 'text'}
                        value={customQuestionAnswers[question.fieldKey] ?? ''}
                        onChange={(event) => setCustomQuestionAnswers((prev) => ({
                          ...prev,
                          [question.fieldKey]: event.target.value,
                        }))}
                        placeholder={question.helpText || undefined}
                        inputMode={question.responseType === 'number' ? 'numeric' : undefined}
                      />
                    )}
                    {question.helpText && (
                      <span style={styles.fieldHelp}>{question.helpText}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
          {guestInfoError && <p style={styles.errorText}>{guestInfoError}</p>}
          <button style={styles.primaryButton} onClick={handleSaveGuestInfo} disabled={savingGuestInfo}>
            {savingGuestInfo ? 'Saving...' : 'Save intake details'}
          </button>
        </article>

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Complaint summary</h2>
          {encounter.priageSummary ? (
            <div style={styles.priageStack}>
              <div style={styles.priageHero}>
                <div style={styles.priageHeroHeader}>
                  <span style={styles.priageBadge}>AI Briefing</span>
                  {encounter.priageSummary.recommendedCtasLevel != null && (
                    <span style={styles.priageCtasPill}>Provisional CTAS {encounter.priageSummary.recommendedCtasLevel}</span>
                  )}
                </div>
                <p style={styles.priageHeroText}>{encounter.priageSummary.briefing}</p>
              </div>

              <div style={styles.priageBlock}>
                <div style={styles.priageLabel}>Case summary</div>
                <p style={styles.priageBody}>{encounter.priageSummary.caseSummary}</p>
              </div>

              {encounter.priageSummary.questionAnswers.length > 0 && (
                <div style={styles.priageBlock}>
                  <div style={styles.priageLabel}>Questions asked</div>
                  <div style={styles.priageQuestionStack}>
                    {encounter.priageSummary.questionAnswers.map((item, index) => (
                      <div key={`${item.answeredAt}-${index}`} style={styles.priageQuestionCard}>
                        <div style={styles.priageQuestionRow}>
                          <div style={styles.priageQuestionHeading}>Question</div>
                          <p style={styles.priageQuestionText}>{item.question}</p>
                        </div>
                        <div style={styles.priageQuestionRow}>
                          <div style={styles.priageAnswerHeading}>Answer</div>
                          <p style={styles.priageAnswerText}>{item.answer}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {encounter.priageSummary.progressionRisks.length > 0 && (
                <div style={styles.priageBlock}>
                  <div style={styles.priageLabel}>Watch for</div>
                  <div style={styles.priageList}>
                    {encounter.priageSummary.progressionRisks.map((risk) => (
                      <div key={risk} style={styles.priageListItem}>{risk}</div>
                    ))}
                  </div>
                </div>
              )}

              {encounter.priageSummary.recommendedAction && (
                <div style={styles.priageBlock}>
                  <div style={styles.priageLabel}>Recommended next step</div>
                  <p style={styles.priageBody}>{encounter.priageSummary.recommendedAction}</p>
                </div>
              )}
            </div>
          ) : (
            <p style={styles.bodyText}>{encounter.chiefComplaint ?? 'No complaint entered.'}</p>
          )}
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
    </main>
  );
}

function HospitalArrivalCard({
  hospital,
  patientLocation,
}: {
  hospital: Hospital;
  patientLocation: PatientCoordinates | null;
}) {
  const distanceLabel = formatHospitalDistance(getHospitalDistanceKm(hospital, patientLocation));

  return (
    <article style={styles.card}>
      <h2 style={styles.cardTitle}>Arrival info</h2>
      <p style={styles.bodyText}>
        {hospital.address ?? 'Hospital address is not configured yet. Directions will use the hospital name.'}
      </p>
      {distanceLabel && <p style={styles.mutedText}>{distanceLabel}</p>}
      {hospital.checkInInstructions && (
        <p style={styles.mutedText}>
          <strong>Check-in:</strong> {hospital.checkInInstructions}
        </p>
      )}
      {hospital.parkingNotes && (
        <p style={styles.mutedText}>
          <strong>Arrival notes:</strong> {hospital.parkingNotes}
        </p>
      )}
      <div style={styles.linkRow}>
        <a
          href={getGoogleMapsDirectionsUrl(hospital, patientLocation)}
          target="_blank"
          rel="noreferrer"
          style={styles.linkButton}
        >
          Google Maps
        </a>
        <a
          href={getAppleMapsDirectionsUrl(hospital, patientLocation)}
          target="_blank"
          rel="noreferrer"
          style={styles.linkButton}
        >
          Apple Maps
        </a>
        {hospital.phone && (
          <a href={`tel:${hospital.phone}`} style={styles.linkButton}>
            Call hospital
          </a>
        )}
      </div>
    </article>
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
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.6rem',
  },
  customQuestionSection: {
    display: 'grid',
    gap: '0.65rem',
    marginTop: '0.15rem',
  },
  customQuestionTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '0.98rem',
    color: patientTheme.colors.ink,
  },
  customQuestionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.7rem',
  },
  fieldLabel: {
    display: 'grid',
    gap: '0.3rem',
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  fieldHelp: {
    fontSize: '0.78rem',
    fontWeight: 500,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
  },
  input: {
    width: '100%',
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.68rem 0.74rem',
    fontSize: '0.92rem',
    fontFamily: patientTheme.fonts.body,
    boxSizing: 'border-box',
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
  priageStack: {
    display: 'grid',
    gap: '0.65rem',
  },
  priageHero: {
    border: '1px solid #bfdbfe',
    borderRadius: patientTheme.radius.sm,
    background: '#eff6ff',
    padding: '0.8rem 0.9rem',
    display: 'grid',
    gap: '0.4rem',
  },
  priageHeroHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  priageBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    background: '#dbeafe',
    color: '#1d4ed8',
    padding: '0.22rem 0.58rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  priageCtasPill: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    background: '#fff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    padding: '0.22rem 0.58rem',
    fontSize: '0.72rem',
    fontWeight: 700,
  },
  priageHeroText: {
    margin: 0,
    fontSize: '0.9rem',
    lineHeight: 1.5,
    color: '#0f172a',
  },
  priageBlock: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    padding: '0.72rem 0.8rem',
    display: 'grid',
    gap: '0.38rem',
  },
  priageLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: patientTheme.colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  priageBody: {
    margin: 0,
    fontSize: '0.88rem',
    lineHeight: 1.48,
    color: patientTheme.colors.ink,
    whiteSpace: 'pre-line',
  },
  priageQuestionStack: {
    display: 'grid',
    gap: '0.55rem',
  },
  priageQuestionCard: {
    border: '1px solid #e5e7eb',
    borderRadius: patientTheme.radius.sm,
    background: '#f8fafc',
    padding: '0.7rem',
    display: 'grid',
    gap: '0.55rem',
  },
  priageQuestionRow: {
    display: 'grid',
    gap: '0.24rem',
  },
  priageQuestionHeading: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  priageAnswerHeading: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#0f766e',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  priageQuestionText: {
    margin: 0,
    fontSize: '0.86rem',
    lineHeight: 1.45,
    color: '#0f172a',
    whiteSpace: 'pre-line',
  },
  priageAnswerText: {
    margin: 0,
    fontSize: '0.86rem',
    lineHeight: 1.45,
    color: '#134e4a',
    whiteSpace: 'pre-line',
  },
  priageList: {
    display: 'grid',
    gap: '0.42rem',
  },
  priageListItem: {
    borderRadius: patientTheme.radius.sm,
    background: '#fff1f2',
    color: '#9f1239',
    padding: '0.52rem 0.6rem',
    fontSize: '0.84rem',
    lineHeight: 1.42,
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
  linkRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
  },
  linkButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.55rem 0.72rem',
    fontWeight: 700,
    fontSize: '0.78rem',
    fontFamily: patientTheme.fonts.body,
    textDecoration: 'none',
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
  errorText: {
    margin: 0,
    color: patientTheme.colors.danger,
    fontSize: '0.82rem',
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
};
