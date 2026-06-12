import { useEffect, useMemo, useState } from 'react';

import { confirmIntent } from '../../shared/api/intake';
import {
  formatHospitalDistance,
  getAppleMapsDirectionsUrl,
  getGoogleMapsDirectionsUrl,
  getHospitalDistanceKm,
  type PatientCoordinates,
} from '../../shared/hospitalDirectory';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import { useHospitalDirectory } from '../../shared/hooks/useHospitalDirectory';
import type { Hospital } from '../../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../../shared/ui/theme';
import { useToast } from '../../shared/ui/ToastContext';

interface RoutingProps {
  onConfirmed: (encounterId: number) => void;
  onBack?: () => void;
  mode?: 'guest' | 'authenticated';
}

export function Routing({ onConfirmed, onBack, mode = 'guest' }: RoutingProps) {
  const { showToast } = useToast();
  const { session, setSession } = useGuestSession();
  const { hospitals, loading, error } = useHospitalDirectory();
  const isGuestFlow = mode === 'guest';
  const [hospitalSlug, setHospitalSlug] = useState(isGuestFlow ? session?.hospitalSlug ?? '' : '');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [patientLocation, setPatientLocation] = useState<PatientCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) {
      return;
    }

    showToast('Could not load hospital list. You can still enter a slug manually.');
  }, [error, showToast]);

  const sortedHospitals = useMemo(() => {
    return [...hospitals].sort((first, second) => {
      const firstDistance = getHospitalDistanceKm(first, patientLocation);
      const secondDistance = getHospitalDistanceKm(second, patientLocation);

      if (firstDistance !== null && secondDistance !== null && firstDistance !== secondDistance) {
        return firstDistance - secondDistance;
      }

      if (firstDistance !== null) {
        return -1;
      }

      if (secondDistance !== null) {
        return 1;
      }

      return first.name.localeCompare(second.name);
    });
  }, [hospitals, patientLocation]);

  useEffect(() => {
    if (hospitalSlug) return;
    if (sortedHospitals.length === 0) return;
    setHospitalSlug(sortedHospitals[0].slug);
  }, [hospitalSlug, sortedHospitals]);

  const selectedHospital = useMemo(
    () => hospitals.find((hospital) => hospital.slug === hospitalSlug) ?? null,
    [hospitalSlug, hospitals],
  );

  if (isGuestFlow && !session) return null;
  const currentSession = session;

  async function handleConfirm() {
    if (!hospitalSlug.trim()) {
      showToast('Please choose a hospital first.');
      return;
    }

    setSubmitting(true);
    try {
      const encounter = await confirmIntent({ hospitalSlug: hospitalSlug.trim() });
      if (isGuestFlow && currentSession) {
        setSession({
          ...currentSession,
          encounterId: encounter.id,
          hospitalSlug: hospitalSlug.trim(),
        });
      }
      onConfirmed(encounter.id);
    } catch (confirmError) {
      showToast(confirmError instanceof Error ? confirmError.message : 'Could not confirm hospital.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleLocateMe() {
    if (!navigator.geolocation) {
      setLocationError('Location is not available in this browser.');
      showToast('Location is not available in this browser.');
      return;
    }

    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPatientLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationError('We could not read your location. You can still select a hospital manually.');
        showToast('We could not read your location. You can still select a hospital manually.');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <span style={styles.badge}>Final Step</span>
          <h1 style={styles.title}>Select your hospital</h1>
          <p style={styles.subtitle}>
            We will send your intake details immediately so staff can prepare before you arrive.
          </p>
        </header>

        {loading ? (
          <p style={styles.loadingLabel}>Loading hospitals…</p>
        ) : sortedHospitals.length > 0 ? (
          <>
            <div style={styles.locationRow}>
              <button style={styles.secondaryButton} onClick={handleLocateMe} type="button" disabled={locating}>
                {locating ? 'Finding you…' : patientLocation ? 'Refresh my location' : 'Use my location'}
              </button>
              <span style={styles.locationHint}>
                {locationError
                  ?? (patientLocation
                    ? 'Hospitals with coordinates are sorted by distance from you.'
                    : 'Share your location to compare nearby hospitals faster.')}
              </span>
            </div>

            <div style={styles.optionGrid}>
              {sortedHospitals.map((hospital) => {
                const selected = hospital.slug === hospitalSlug;
                const distanceLabel = formatHospitalDistance(getHospitalDistanceKm(hospital, patientLocation));

                return (
                  <button
                    key={hospital.id}
                    style={{
                      ...styles.optionCard,
                      borderColor: selected ? patientTheme.colors.accent : patientTheme.colors.line,
                      boxShadow: selected ? '0 12px 26px rgba(25,73,184,0.18)' : patientTheme.shadows.card,
                    }}
                    onClick={() => setHospitalSlug(hospital.slug)}
                    type="button"
                  >
                    <div style={styles.optionTop}>
                      <strong style={styles.optionTitle}>{hospital.name}</strong>
                      {distanceLabel && <span style={styles.distancePill}>{distanceLabel}</span>}
                    </div>
                    <span style={styles.optionMeta}>{hospital.address ?? `Hospital slug: ${hospital.slug}`}</span>
                    {hospital.phone && <span style={styles.optionMeta}>Phone: {hospital.phone}</span>}
                    <span style={styles.optionMeta}>
                      {selected ? 'Selected for check-in' : 'Tap to choose this hospital'}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedHospital && (
              <HospitalDetailsCard
                hospital={selectedHospital}
                patientLocation={patientLocation}
              />
            )}
          </>
        ) : (
          <label style={styles.manualLabel}>
            Hospital slug
            <input
              value={hospitalSlug}
              onChange={(event) => setHospitalSlug(event.target.value)}
              placeholder="e.g. priage-general"
              style={styles.input}
              autoFocus
            />
          </label>
        )}

        <div style={styles.buttonRow}>
          {onBack && (
            <button style={styles.secondaryButton} type="button" onClick={onBack}>
              ← Back
            </button>
          )}
          <button style={styles.primaryButton} type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Notifying hospital…' : 'Notify hospital'}
          </button>
        </div>

        <footer style={styles.footer}>
          After confirmation, you will see live status updates and messaging from the care team.
        </footer>
      </section>
    </main>
  );
}

function HospitalDetailsCard({
  hospital,
  patientLocation,
}: {
  hospital: Hospital;
  patientLocation: PatientCoordinates | null;
}) {
  const distanceLabel = formatHospitalDistance(getHospitalDistanceKm(hospital, patientLocation));

  return (
    <article style={styles.selectedCard}>
      <div style={styles.selectedTop}>
        <div>
          <h2 style={styles.selectedTitle}>{hospital.name}</h2>
          <p style={styles.selectedBody}>
            {hospital.address ?? 'Address is not configured yet. Directions will use the hospital name.'}
          </p>
        </div>
        {distanceLabel && <span style={styles.distancePill}>{distanceLabel}</span>}
      </div>

      {hospital.checkInInstructions && (
        <p style={styles.selectedBody}>
          <strong>Check-in:</strong> {hospital.checkInInstructions}
        </p>
      )}

      {hospital.parkingNotes && (
        <p style={styles.selectedBody}>
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
    display: 'grid',
    placeItems: 'center',
    background: heroBackdrop,
    padding: '1rem',
    fontFamily: patientTheme.fonts.body,
  },
  card: {
    width: '100%',
    maxWidth: '760px',
    border: panelBorder,
    borderRadius: patientTheme.radius.xl,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.panel,
    padding: '1rem',
    display: 'grid',
    gap: '0.72rem',
  },
  header: {
    display: 'grid',
    gap: '0.32rem',
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
    fontSize: '0.74rem',
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.32rem',
  },
  subtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
    fontSize: '0.9rem',
  },
  loadingLabel: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
  },
  locationRow: {
    display: 'grid',
    gap: '0.35rem',
    alignItems: 'start',
  },
  locationHint: {
    fontSize: '0.8rem',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.55rem',
  },
  optionCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    textAlign: 'left',
    padding: '0.7rem',
    display: 'grid',
    gap: '0.3rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  optionTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.4rem',
  },
  optionTitle: {
    fontSize: '0.9rem',
    lineHeight: 1.3,
  },
  optionMeta: {
    fontSize: '0.77rem',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
  },
  distancePill: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    background: '#eef4ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.18rem 0.5rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  selectedCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    padding: '0.8rem',
    display: 'grid',
    gap: '0.45rem',
    boxShadow: patientTheme.shadows.card,
  },
  selectedTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.7rem',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  selectedTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1rem',
  },
  selectedBody: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.84rem',
    lineHeight: 1.5,
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
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    textDecoration: 'none',
  },
  manualLabel: {
    display: 'grid',
    gap: '0.3rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  input: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.68rem 0.74rem',
    fontSize: '0.92rem',
    fontFamily: patientTheme.fonts.body,
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.52rem',
    justifyContent: 'space-between',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.7rem 0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    flex: 1,
    minWidth: '180px',
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.7rem 0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  footer: {
    borderTop: panelBorder,
    paddingTop: '0.62rem',
    color: patientTheme.colors.inkMuted,
    fontSize: '0.8rem',
    lineHeight: 1.45,
  },
};
