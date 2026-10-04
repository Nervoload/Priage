import { useEffect, useMemo, useState } from 'react';

import { attachClinic, confirmIntent } from '../../shared/api/intake';
import { friendlyError } from '../../shared/api/errors';
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
import { CtaButton, LoadingScreen } from '../../shared/ui/Controls';
import { TextField } from '../../shared/ui/Field';
import { FlowScreen } from '../../shared/ui/FlowScreen';
import { Icon } from '../../shared/ui/Icon';
import { useToast } from '../../shared/ui/ToastContext';

interface RoutingProps {
  onConfirmed: (encounterId: number, clinicAlias?: string) => void;
  onBack?: () => void;
  mode?: 'guest' | 'authenticated';
}

function isClinic(hospital: Hospital | null | undefined): boolean {
  return hospital?.workflowProfile === 'CLINIC_APPOINTMENT';
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

    showToast('We couldn’t load care locations. You can still enter a hospital code.');
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
  const clinicSelected = isClinic(selectedHospital);
  const clinicUnavailable = clinicSelected && !selectedHospital?.appointmentBookingAvailable;

  async function handleConfirm() {
    if (!hospitalSlug.trim()) {
      showToast('Choose where you’d like to receive care first.');
      return;
    }

    setSubmitting(true);
    try {
      const clinicAlias = clinicSelected ? selectedHospital?.entryPath?.split('/')[1] : undefined;
      if (clinicSelected && (!clinicAlias || !selectedHospital?.appointmentBookingAvailable)) {
        showToast('This clinic isn’t accepting appointment requests right now.');
        return;
      }
      const encounter = clinicAlias ? await attachClinic(clinicAlias) : await confirmIntent({ hospitalSlug: hospitalSlug.trim() });
      if (isGuestFlow && currentSession) {
        setSession({
          ...currentSession,
          encounterId: encounter.id,
          hospitalSlug: hospitalSlug.trim(),
          clinicAlias,
        });
      }
      onConfirmed(encounter.id, clinicAlias);
    } catch (confirmError) {
      showToast(friendlyError(confirmError, 'We couldn’t send your answers. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleLocateMe() {
    if (!navigator.geolocation) {
      setLocationError('Location isn’t available in this browser.');
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
        setLocationError('We couldn’t read your location. You can still choose from the list.');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const ctaLabel = submitting
    ? 'Sending…'
    : clinicSelected
      ? 'Continue to appointment times'
      : 'Send my answers';

  return (
    <FlowScreen
      title="Where to go"
      counter="Step 3 of 3"
      progress={88}
      onBack={onBack}
      label="Choose where to receive care"
      footer={(
        <>
          <CtaButton onClick={() => void handleConfirm()} busy={submitting} disabled={submitting || loading || clinicUnavailable || !hospitalSlug.trim()}>
            {ctaLabel}
          </CtaButton>
          <p className="flow__note">
            {clinicSelected
              ? 'The clinic confirms your requested time before it’s booked.'
              : 'The emergency department sees your answers as soon as you send them.'}
          </p>
        </>
      )}
    >
      <div className="stack stack--sm">
        <h1 className="display">Where would you like to go?</h1>
        <p className="lede">Choose an emergency department to share your answers now, or a clinic to request an appointment.</p>
      </div>

      {loading ? (
        <LoadingScreen label="Finding care locations…" />
      ) : sortedHospitals.length > 0 ? (
        <>
          <div className="cluster" style={{ '--cluster-gap': '12px' } as React.CSSProperties}>
            <button type="button" className="btn btn--secondary btn--sm" onClick={handleLocateMe} disabled={locating}>
              <Icon name="locate" size={18} />
              {locating ? 'Finding you…' : patientLocation ? 'Update my location' : 'Sort by distance'}
            </button>
            {(locationError || patientLocation) && (
              <span className="small" role="status">{locationError ?? 'Sorted by distance from you.'}</span>
            )}
          </div>

          <fieldset className="choice-list" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="sr-only">Care locations</legend>
            {sortedHospitals.map((hospital) => {
              const distance = formatHospitalDistance(getHospitalDistanceKm(hospital, patientLocation));
              const clinic = isClinic(hospital);
              const unavailable = clinic && !hospital.appointmentBookingAvailable;
              return (
                <label key={hospital.id} className="choice place">
                  <input
                    type="radio"
                    name="care-location"
                    value={hospital.slug}
                    checked={hospital.slug === hospitalSlug}
                    onChange={() => setHospitalSlug(hospital.slug)}
                  />
                  <span className="choice__dot" style={{ marginTop: 2 }}><Icon name="check" size={12} strokeWidth={2.6} /></span>
                  <span className="choice__text">
                    <span className="place__kind">{clinic ? 'Clinic' : 'Emergency department'}{distance ? `, ${distance}` : ''}</span>
                    <span className="place__name">{hospital.name}</span>
                    <span className="choice__meta">
                      {unavailable ? 'Not taking appointment requests right now' : hospital.address ?? 'Address not listed'}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {selectedHospital && <HospitalDetails hospital={selectedHospital} patientLocation={patientLocation} />}
        </>
      ) : (
        <div>
          <TextField
            label="Hospital code"
            value={hospitalSlug}
            onChange={(event) => setHospitalSlug(event.target.value)}
            placeholder="e.g. priage-general"
            hint="Your hospital can give you this code."
            autoFocus
          />
        </div>
      )}
    </FlowScreen>
  );
}

function HospitalDetails({
  hospital,
  patientLocation,
}: {
  hospital: Hospital;
  patientLocation: PatientCoordinates | null;
}) {
  const hasNotes = hospital.checkInInstructions || hospital.parkingNotes;
  return (
    <section className="card" aria-label={`${hospital.name} details`}>
      {hasNotes && (
        <div className="rows">
          {hospital.checkInInstructions && (
            <div className="row">
              <span className="row__main">
                <span className="row__key">When you arrive</span>
                <span className="row__value">{hospital.checkInInstructions}</span>
              </span>
            </div>
          )}
          {hospital.parkingNotes && (
            <div className="row">
              <span className="row__main">
                <span className="row__key">Parking and entrance</span>
                <span className="row__value">{hospital.parkingNotes}</span>
              </span>
            </div>
          )}
        </div>
      )}
      <div className="cluster" style={{ padding: 16, borderTop: hasNotes ? '1px solid var(--line)' : undefined }}>
        <a className="btn btn--secondary btn--sm" href={getGoogleMapsDirectionsUrl(hospital, patientLocation)} target="_blank" rel="noreferrer">
          <Icon name="navigation" size={17} />
          Google Maps
        </a>
        <a className="btn btn--secondary btn--sm" href={getAppleMapsDirectionsUrl(hospital, patientLocation)} target="_blank" rel="noreferrer">
          <Icon name="mapPin" size={17} />
          Apple Maps
        </a>
        {hospital.phone && (
          <a className="btn btn--secondary btn--sm" href={`tel:${hospital.phone}`}>
            <Icon name="phone" size={17} />
            Call
          </a>
        )}
      </div>
    </section>
  );
}
