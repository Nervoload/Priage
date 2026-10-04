import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { ApiError, client } from '../shared/api/client';
import { CtaButton, LoadingScreen, StatusPill, type StatusDot, type StatusTone } from '../shared/ui/Controls';
import { Icon } from '../shared/ui/Icon';
import { ClinicPageFrame } from './ClinicPageFrame';

export type Appointment = { id: number; status: 'REQUESTED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED' | 'NO_SHOW' | 'COMPLETED'; requestedStartAt: string; confirmedStartAt: string | null; timezone: string; expiresAt: string | null; revision: number };
export type ClinicVisitState = {
  encounter: { id: number; status: string; hospitalId: number; chiefComplaint: string | null; updatedAt: string };
  canonicalAlias: string | null;
  contactEmail: string | null;
  contactVerified?: boolean;
  interviewStatus: string | null;
  /** 'pending' after the assessment means the clinic's own questions come before booking. */
  clinicQuestions?: 'none' | 'pending' | 'answered';
  appointment: Appointment | null;
  bookingReadiness: { ready: boolean; scheduleConfigured: boolean; legalPublished: boolean };
  allowedActions: string[];
  revision: number;
  notifications?: Array<{ purpose: string; status: string; provider: string | null }>;
};
type AppointmentResult = Appointment & { visitState: ClinicVisitState };
type Slot = { startAt: string; endAt: string; localDate: string; remaining: number };
export type Availability = { configured: boolean; timezone: string | null; slots: Slot[] };
type LegalDocument = { id: number; kind: 'TERMS' | 'PRIVACY'; version: string; bodyMarkdown: string };
type LegalDocuments = { terms: LegalDocument | null; privacy: LegalDocument | null; ready: boolean };

function currentStateFromConflict(cause: unknown, encounterId: number): ClinicVisitState | null {
  if (!(cause instanceof ApiError) || cause.status !== 409) return null;
  try {
    const value = JSON.parse(cause.body) as { visitState?: ClinicVisitState };
    return value.visitState?.encounter.id === encounterId ? value.visitState : null;
  } catch { return null; }
}

export function displayTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
}

/** Splits an instant into a headline day ("Tue, Sep 29") and a time line ("10:30 a.m. EDT"). */
export function displayTimeParts(value: string, timezone: string) {
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat('en-CA', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date),
  };
}

function dayParts(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', ...options }).format(date);
  return { weekday: format({ weekday: 'short' }), day: format({ day: 'numeric' }), month: format({ month: 'short' }), full: format({ weekday: 'long', month: 'long', day: 'numeric' }) };
}

function slotTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function slotHour(value: string, timezone: string) {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date(value)));
}

function timezoneName(timezone: string, sample?: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, timeZoneName: 'long' }).formatToParts(sample ? new Date(sample) : new Date());
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timezone;
}

const APPOINTMENT_STATUS: Record<Appointment['status'], { label: string; tone: StatusTone; dot: StatusDot }> = {
  REQUESTED: { label: 'Waiting for confirmation', tone: 'amber', dot: 'ring' },
  CONFIRMED: { label: 'Confirmed', tone: 'blue', dot: 'solid' },
  DECLINED: { label: 'Not available', tone: 'red', dot: 'x' },
  CANCELLED: { label: 'Cancelled', tone: 'red', dot: 'x' },
  EXPIRED: { label: 'Request expired', tone: 'neutral', dot: 'x' },
  NO_SHOW: { label: 'Missed', tone: 'neutral', dot: 'x' },
  COMPLETED: { label: 'Visit complete', tone: 'neutral', dot: 'check' },
};

export function appointmentStatus(appointment: Appointment, encounterStatus?: string) {
  if (encounterStatus === 'COMPLETE') return APPOINTMENT_STATUS.COMPLETED;
  if (encounterStatus === 'CARE') return { label: 'With your clinician', tone: 'teal' as StatusTone, dot: 'square' as StatusDot };
  if (encounterStatus === 'ADMITTED') return { label: 'Checked in', tone: 'green' as StatusTone, dot: 'solid' as StatusDot };
  return APPOINTMENT_STATUS[appointment.status];
}

export function AppointmentSummary({ appointment, encounterStatus, showStatus = true, children }: { appointment: Appointment; encounterStatus?: string; showStatus?: boolean; children?: React.ReactNode }) {
  const status = appointmentStatus(appointment, encounterStatus);
  const when = displayTimeParts(appointment.confirmedStartAt || appointment.requestedStartAt, appointment.timezone);
  return (
    <section className="card card--raised card--pad stack" aria-label="Appointment">
      {showStatus && (
        <div className="cluster" style={{ justifyContent: 'space-between' }}>
          <StatusPill tone={status.tone} dot={status.dot} pulse={appointment.status === 'REQUESTED' && !encounterStatus?.match(/ADMITTED|CARE|COMPLETE/)}>{status.label}</StatusPill>
        </div>
      )}
      <div className="big-time">
        <span className="big-time__day">{when.day}</span>
        <span className="big-time__meta">{appointment.status === 'REQUESTED' ? `${when.time}, requested` : when.time}</span>
      </div>
      {children}
    </section>
  );
}

export function ClinicSlotPicker({ availability, selected, onSelect, name }: { availability: Availability; selected: string; onSelect: (value: string) => void; name: string }) {
  const days = useMemo(() => [...new Set(availability.slots.map((slot) => slot.localDate))], [availability]);
  const [date, setDate] = useState('');
  const visibleDate = days.includes(date) ? date : days[0];
  const timezone = availability.timezone ?? 'UTC';
  const groups = useMemo(() => {
    const slots = availability.slots.filter((slot) => slot.localDate === visibleDate);
    const buckets = [
      { label: 'Morning', slots: slots.filter((slot) => slotHour(slot.startAt, timezone) < 12) },
      { label: 'Afternoon', slots: slots.filter((slot) => { const hour = slotHour(slot.startAt, timezone); return hour >= 12 && hour < 17; }) },
      { label: 'Evening', slots: slots.filter((slot) => slotHour(slot.startAt, timezone) >= 17) },
    ];
    return buckets.filter((bucket) => bucket.slots.length > 0);
  }, [availability, timezone, visibleDate]);

  if (!availability.slots.length) {
    return (
      <p className="notice" role="status">
        <Icon name="calendar" size={18} />
        <span>No times are open in the next seven days. Contact the clinic and they’ll help you find one.</span>
      </p>
    );
  }

  return (
    <div className="stack stack--lg">
      <div className="days" role="group" aria-label="Available dates">
        {days.map((day, index) => {
          const parts = dayParts(day);
          // Show the month once, then only where it changes.
          const showMonth = index === 0 || dayParts(days[index - 1]).month !== parts.month;
          return (
            <button
              key={day}
              type="button"
              className="day"
              aria-pressed={visibleDate === day}
              aria-label={parts.full}
              onClick={() => { setDate(day); onSelect(''); }}
            >
              <span className="day__weekday">{parts.weekday}</span>
              <span className="day__date">{parts.day}</span>
              <span className="day__month">{showMonth ? parts.month : '\u00a0'}</span>
            </button>
          );
        })}
      </div>

      {groups.map((group) => (
        <fieldset key={group.label} style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 10 }}>{group.label}</legend>
          <div className="slots">
            {group.slots.map((slot) => (
              <label key={slot.startAt} className="slot">
                <input type="radio" name={name} checked={selected === slot.startAt} onChange={() => onSelect(slot.startAt)} />
                {slotTime(slot.startAt, timezone)}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <p className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="clock" size={15} />
        Times shown in {timezoneName(timezone, availability.slots[0]?.startAt)}
      </p>
    </div>
  );
}

function SelectedTime({ value, timezone }: { value: string; timezone: string }) {
  const when = displayTimeParts(value, timezone);
  return (
    <div className="link-card link-card--static">
      <span className="tray__icon"><Icon name="calendar" size={22} /></span>
      <span className="tray__text">
        <span className="tray__title">{when.day} at {when.time}</span>
        <span className="small">Not booked until the clinic confirms it</span>
      </span>
    </div>
  );
}

export function ClinicBooking({ encounterId, state, onState, onRefresh, alias }: {
  encounterId: number; state: ClinicVisitState; onState: (state: ClinicVisitState) => void; onRefresh: () => Promise<void>; alias?: string;
}) {
  const appointment = state.appointment;
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [legal, setLegal] = useState<LegalDocuments | null>(null);
  const [selected, setSelected] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justRequested, setJustRequested] = useState<{ startAt: string; timezone: string } | null>(null);
  const closeMoment = useCallback(() => setJustRequested(null), []);

  const refresh = useCallback(async () => {
    const base = `/clinic-intake/visits/${encounterId}`;
    const [nextAvailability, nextLegal] = await Promise.all([
      client<Availability>(`${base}/availability`),
      client<LegalDocuments>(`${base}/legal-documents`),
    ]);
    setAvailability(nextAvailability); setLegal(nextLegal);
    setSelected((current) => nextAvailability.slots.some((slot) => slot.startAt === current) ? current : '');
  }, [encounterId]);
  useEffect(() => { void refresh().catch(() => setError('Appointment times are unavailable right now. Refresh to try again.')); }, [refresh]);

  async function submitRequest() {
    if (!selected || !legal?.terms || !legal.privacy || !accepted || busy) return;
    setBusy(true); setError('');
    const storageKey = `clinic-request-${encounterId}`;
    const requestKey = sessionStorage.getItem(storageKey) || crypto.randomUUID();
    sessionStorage.setItem(storageKey, requestKey);
    try {
      const result = await client<AppointmentResult>(`/clinic-intake/visits/${encounterId}/appointment-request`, { method: 'POST', body: JSON.stringify({
        requestKey, startAt: selected, termsDocumentId: legal.terms.id, privacyDocumentId: legal.privacy.id, accepted,
      }) });
      sessionStorage.removeItem(storageKey);
      onState(result.visitState); setSelected(''); setAccepted(false);
      setJustRequested({ startAt: result.requestedStartAt || selected, timezone: result.timezone || availability?.timezone || 'UTC' });
    } catch (cause) {
      const conflict = cause instanceof ApiError && cause.status === 409;
      if (conflict) sessionStorage.removeItem(storageKey);
      const current = currentStateFromConflict(cause, encounterId);
      if (current) onState(current);
      else await onRefresh().catch(() => {});
      setError(conflict ? 'That time or visit changed. We’ve loaded the latest details and open times.' : 'We couldn’t send your request. Please try again.');
      await refresh().catch(() => {});
    } finally { setBusy(false); }
  }

  async function command(kind: 'reschedule' | 'cancel') {
    if (!appointment || busy) return;
    if (kind === 'reschedule' && !selected) return;
    setBusy(true); setError('');
    const storageKey = `clinic-command-${appointment.id}-${kind}`;
    const commandKey = sessionStorage.getItem(storageKey) || crypto.randomUUID();
    sessionStorage.setItem(storageKey, commandKey);
    try {
      const result = await client<AppointmentResult>(`/clinic-intake/visits/${encounterId}/appointment/${kind}`, { method: 'POST', body: JSON.stringify({ commandKey, expectedRevision: appointment.revision, ...(kind === 'reschedule' ? { startAt: selected } : {}) }) });
      sessionStorage.removeItem(storageKey);
      onState(result.visitState); setRescheduling(false); setConfirmCancel(false); setSelected('');
      await refresh();
    } catch (cause) {
      const conflict = cause instanceof ApiError && cause.status === 409;
      if (conflict) sessionStorage.removeItem(storageKey);
      const current = currentStateFromConflict(cause, encounterId);
      if (current) onState(current);
      else await onRefresh().catch(() => {});
      setError(conflict ? 'This appointment changed. We’ve loaded the latest details.' : 'We couldn’t change the appointment. Please try again.');
      await refresh().catch(() => {});
    } finally { setBusy(false); }
  }

  const active = appointment?.status === 'REQUESTED' || appointment?.status === 'CONFIRMED';
  const showSlots = (!appointment || rescheduling) && availability?.configured && (appointment ? state.allowedActions.includes('reschedule') : state.allowedActions.includes('request') && legal?.ready);
  const confirmationNote = state.notifications?.some((item) => item.purpose === 'confirmation' && item.provider === 'capture')
    ? 'Your confirmation email is in the local test inbox.'
    : state.notifications?.some((item) => item.purpose === 'confirmation' && item.status === 'DELIVERED')
      ? 'We emailed your confirmation to your visit email.'
      : state.notifications?.some((item) => item.purpose === 'confirmation' && ['QUEUED', 'PROCESSING', 'ACCEPTED'].includes(item.status))
        ? 'Your confirmation email is on its way.'
        : 'Contact the clinic if you need a copy of your appointment details.';

  return (
    <section className="stack stack--lg" aria-labelledby="clinic-booking-title">
      <h2 id="clinic-booking-title" className="sr-only">Appointment</h2>
      {justRequested && <RequestSentMoment startAt={justRequested.startAt} timezone={justRequested.timezone} email={state.contactEmail} onClose={closeMoment} />}
      {error && (
        <p role="alert" className="notice notice--danger">
          <Icon name="alertCircle" size={18} />
          <span>{error}</span>
        </p>
      )}

      {appointment && (
        <AppointmentSummary appointment={appointment} encounterStatus={state.encounter.status} showStatus={false}>
          {appointment.status === 'REQUESTED' && (
            <p className="body">
              {heldUntil(appointment)} We’ll email you once it’s confirmed.
            </p>
          )}
          {appointment.status === 'CONFIRMED' && !['ADMITTED', 'CARE', 'COMPLETE'].includes(state.encounter.status) && <p className="body">{confirmationNote}</p>}
          {active && !rescheduling && !confirmCancel && (state.allowedActions.includes('reschedule') || state.allowedActions.includes('cancel')) && (
            <div className="cluster" style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
              {state.allowedActions.includes('reschedule') && (
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setRescheduling(true); setSelected(''); }}>
                  Request another time
                </button>
              )}
              {state.allowedActions.includes('cancel') && (
                <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => setConfirmCancel(true)}>
                  Cancel request
                </button>
              )}
            </div>
          )}
          {confirmCancel && (
            <div className="notice notice--warn" role="group" aria-label="Cancel appointment">
              <Icon name="alertTriangle" size={18} />
              <div className="stack stack--sm" style={{ flex: 1 }}>
                <strong>Cancel this appointment?</strong>
                <div className="cluster">
                  <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={() => void command('cancel')}>{busy ? 'Cancelling…' : 'Yes, cancel'}</button>
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => setConfirmCancel(false)}>Keep it</button>
                </div>
              </div>
            </div>
          )}
        </AppointmentSummary>
      )}

      {!availability && !legal && !error && <LoadingScreen label="Loading open times…" />}
      {availability && !availability.configured && !appointment && (
        <p className="notice" role="status"><Icon name="clock" size={18} /><span>This clinic hasn’t set its hours yet, so booking isn’t available.</span></p>
      )}
      {legal && !legal.ready && !appointment && (
        <p className="notice" role="status"><Icon name="document" size={18} /><span>Booking opens once the clinic publishes its Terms and Privacy Policy.</span></p>
      )}

      {showSlots && (
        <div className="stack stack--lg">
          {rescheduling && <h2 className="title">Choose a new time</h2>}
          <ClinicSlotPicker availability={availability} selected={selected} onSelect={setSelected} name={`clinic-slot-${encounterId}`} />
          {selected && <SelectedTime value={selected} timezone={availability.timezone ?? 'UTC'} />}
          {!appointment && legal?.terms && legal.privacy && (
            <label className="check">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>
                I’ve read and agree to the{' '}
                <Link to={alias ? `/clinic/${alias}/terms` : '/terms'} target="_blank">Terms of Service</Link>
                {' '}and{' '}
                <Link to={alias ? `/clinic/${alias}/privacy` : '/privacy'} target="_blank">Privacy Policy</Link>.
                <span className="small" style={{ display: 'block' }}>Versions {legal.terms.version} and {legal.privacy.version}</span>
              </span>
            </label>
          )}
          <div className="stack stack--sm">
            <CtaButton busy={busy} disabled={busy || !selected || (!appointment && !accepted)} onClick={() => void (appointment ? command('reschedule') : submitRequest())}>
              {busy ? 'Sending…' : appointment ? 'Request this time' : 'Confirm visit request'}
            </CtaButton>
            {!appointment && <p className="flow__note">This is a request, not a booking yet. We’ll email you once the clinic confirms.</p>}
            {rescheduling && (
              <button className="btn btn--quiet btn--block" type="button" onClick={() => { setRescheduling(false); setSelected(''); }}>
                Keep my current time
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function heldUntil(appointment: Appointment): string {
  if (!appointment.expiresAt) return 'The clinic is holding this time while it reviews your request.';
  const held = displayTimeParts(appointment.expiresAt, appointment.timezone);
  return `The clinic is holding this time until ${held.day}, ${held.time}.`;
}

function RequestSentMoment({ startAt, timezone, email, onClose }: { startAt: string; timezone: string; email: string | null; onClose: () => void }) {
  const actionRef = useRef<HTMLButtonElement>(null);
  const when = displayTimeParts(startAt, timezone);

  useEffect(() => {
    actionRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="moment screen screen--navy" role="dialog" aria-modal="true" aria-labelledby="request-sent-title">
      <div className="glow" style={{ width: 560, height: 560, top: -150, left: -190 }} />
      <div className="flow">
        <div className="flow__body">
          <span className="check-burst reveal">
            <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <h1 id="request-sent-title" className="display display--xl reveal">Request sent</h1>
          <p className="lede reveal" style={{ color: 'var(--on-navy-2)' }}>
            The clinic will review your answers and confirm your time.
            {email && <> We’ll email <strong style={{ color: 'var(--on-navy)', fontWeight: 600 }}>{email}</strong>.</>}
          </p>
          <div className="navy-panel reveal">
            <span className="label">Requested</span>
            <span style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{when.day} at {when.time}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 14, color: '#F6C26B' }}>
              <span className="status__dot status__dot--pulse" style={{ color: '#F2A93B' }} />
              Waiting for the clinic to confirm
            </span>
          </div>
        </div>
        <footer className="flow__footer">
          <button ref={actionRef} type="button" className="btn btn--cta btn--block btn--inverse" onClick={onClose}>
            <span>View your visit</span>
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export function ClinicLegalDocument({ kind }: { kind: 'terms' | 'privacy' }) {
  const { alias } = useParams();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void client<LegalDocuments>(alias ? `/clinic-intake/entry/${alias}/legal-documents` : '/clinic-intake/legal-documents').then((value) => setDocument(kind === 'terms' ? value.terms : value.privacy))
      .catch(() => setError('This document isn’t available right now.')).finally(() => setLoading(false));
  }, [kind, alias]);
  return (
    <ClinicPageFrame title={kind === 'terms' ? 'Terms of Service' : 'Privacy Policy'} lede={document ? `Version ${document.version}` : undefined}>
      <div>
        <Link to={alias ? `/${alias}/start` : '/'} className="text-btn"><Icon name="chevronLeft" size={18} />Back to the clinic</Link>
      </div>
      {error && <p role="alert" className="notice notice--danger"><Icon name="alertCircle" size={18} /><span>{error}</span></p>}
      {document ? (
        <article className="card card--pad prose">{document.bodyMarkdown}</article>
      ) : !error && (loading ? <LoadingScreen label="Loading document…" /> : <p className="notice" role="status"><Icon name="document" size={18} /><span>No document has been published yet.</span></p>)}
    </ClinicPageFrame>
  );
}
