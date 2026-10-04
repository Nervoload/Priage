import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { ApiError, client } from '../shared/api/client';
import { CtaButton, LoadingScreen } from '../shared/ui/Controls';
import { TextField } from '../shared/ui/Field';
import { Icon } from '../shared/ui/Icon';
import { ClinicPageFrame } from './ClinicPageFrame';
import { AppointmentSummary, ClinicSlotPicker, type Appointment, type Availability } from './ClinicBooking';

type RecoveryState = {
  reference: string;
  clinic: { name: string; alias: string; replyTo: string | null; contactPhone: string | null };
  encounter: { id: number; status: string; updatedAt: string };
  appointment: Appointment;
  revision: number;
  allowedActions: string[];
  verificationFresh: boolean;
};
const recoveryClient = <T,>(path: string, options: RequestInit = {}) => client<T>(path, { ...options, independentSession: true });

export function ClinicAppointmentRecovery() {
  const { alias = '' } = useParams();
  const location = useLocation();
  const reference = new URLSearchParams(location.hash.slice(1)).get('ref') || '';
  const [clinic, setClinic] = useState<{ name: string; alias: string } | null>(null);
  const [state, setState] = useState<RecoveryState | null>(null);
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const canonicalAlias = clinic?.alias;

  const apply = useCallback((next: RecoveryState) => {
    if (!reference || next.reference !== reference || next.clinic.alias !== canonicalAlias) return;
    setState((old) => old && (old.revision > next.revision || (old.revision === next.revision && old.encounter.updatedAt > next.encounter.updatedAt)) ? old : next);
  }, [reference, canonicalAlias]);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const next = await recoveryClient<RecoveryState>('/clinic-intake/recovery/state');
      if (request === generation.current) apply(next);
    } catch (cause) {
      if (request !== generation.current) return;
      if (cause instanceof ApiError && cause.status === 401) { setState(null); setVerifying(true); }
      else setError('Appointment details are temporarily unavailable. We will retry automatically.');
    }
  }, [apply]);

  useEffect(() => {
    let active = true;
    setState(null); setClinic(null); setChallenge(''); setError('');
    void recoveryClient<{ name: string; alias: string }>(`/clinic-intake/entry/${encodeURIComponent(alias)}`).then((entry) => { if (active) setClinic(entry); }).catch(() => { if (active) setError('This clinic link is unavailable. Contact the clinic for help.'); });
    return () => { active = false; generation.current++; };
  }, [alias, reference]);
  useEffect(() => {
    if (!canonicalAlias || !reference) return;
    void refresh();
    const update = () => void refresh();
    const timer = window.setInterval(update, 15_000);
    window.addEventListener('focus', update); window.addEventListener('online', update);
    return () => { generation.current++; clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('online', update); };
  }, [canonicalAlias, reference, refresh]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (!rescheduling || !state) return;
    let active = true;
    const update = () => void recoveryClient<Availability>('/clinic-intake/recovery/availability').then((next) => {
      if (!active) return; setAvailability(next); setSelected((old) => next.slots.some((slot) => slot.startAt === old) ? old : '');
    }).catch(() => { if (active) setError('Available times could not be loaded.'); });
    update(); const timer = window.setInterval(update, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [rescheduling, state?.appointment.id]);

  async function requestCode(event: FormEvent) {
    event.preventDefault(); if (!clinic || !reference || busy || cooldown) return;
    setBusy(true); setError('');
    try {
      const response = await recoveryClient<{ challengeId: string; message: string }>(`/clinic-intake/entry/${encodeURIComponent(clinic.alias)}/recovery/request`, { method: 'POST', body: JSON.stringify({ reference, email }) });
      setChallenge(response.challengeId); setCode(''); setCooldown(60); setNotice(response.message);
    } catch { setError('The code could not be requested. Wait a minute and try again, or contact the clinic.'); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); if (!clinic || !challenge || busy) return;
    setBusy(true); setError('');
    try {
      await recoveryClient(`/clinic-intake/entry/${encodeURIComponent(clinic.alias)}/recovery/verify`, { method: 'POST', body: JSON.stringify({ challengeId: challenge, code }) });
      setChallenge(''); setCode(''); setVerifying(false); setNotice('Email verified. Appointment access lasts 24 hours; changes require recent verification.');
      await refresh();
    } catch { setError('Invalid or expired code. Codes expire after 10 minutes and allow five attempts.'); }
    finally { setBusy(false); }
  }
  async function command(kind: 'reschedule' | 'cancel') {
    if (!state || busy) return;
    if (!state.verificationFresh) { setVerifying(true); setNotice('Verify your visit email again before making a change.'); return; }
    setBusy(true); setError('');
    const key = `recovery-command-${reference}-${kind}`;
    const commandKey = sessionStorage.getItem(key) || crypto.randomUUID();
    sessionStorage.setItem(key, commandKey);
    try {
      const next = await recoveryClient<RecoveryState>(`/clinic-intake/recovery/${kind}`, { method: 'POST', body: JSON.stringify({ commandKey, expectedRevision: state.revision, ...(kind === 'reschedule' ? { startAt: selected } : {}) }) });
      generation.current++; apply(next); sessionStorage.removeItem(key); setRescheduling(false); setCancelling(false); setSelected('');
      setNotice(kind === 'reschedule' ? 'Your new time awaits Reception confirmation. The previous time is no longer active.' : 'Your appointment was cancelled.');
    } catch (cause) {
      if (cause instanceof ApiError && [400, 403, 409].includes(cause.status)) sessionStorage.removeItem(key);
      if (cause instanceof ApiError && cause.status === 409) {
        try { const result = JSON.parse(cause.body) as { visitState?: RecoveryState }; if (result.visitState) { generation.current++; apply(result.visitState); } } catch { /* periodic refresh also recovers state */ }
        setError('The appointment or available time changed. Current details have been loaded.');
      } else if (cause instanceof ApiError && [401, 403].includes(cause.status)) { setVerifying(true); setError('Verify your visit email again before making a change.'); }
      else setError('The change could not be saved. Try again or contact the clinic.');
      await refresh(); setAvailability(null); setSelected('');
    } finally { setBusy(false); }
  }
  async function logout() {
    await recoveryClient('/clinic-intake/recovery/logout', { method: 'POST', body: '{}' });
    generation.current++; setState(null); setVerifying(true); setChallenge(''); setNotice('Appointment access ended. Your patient account login is unchanged.');
  }
  const appointment = state?.appointment;
  return <ClinicPageFrame
    title={state && appointment && !verifying ? 'Your appointment' : 'Manage your appointment'}
    lede={clinic ? `${clinic.name}. To protect your privacy, we confirm your visit email before showing appointment details.` : 'To protect your privacy, we confirm your visit email before showing appointment details.'}
  >
    {!reference && <p role="alert" className="notice notice--danger"><Icon name="alertCircle" size={18} /><span>Open the link from your appointment email, or contact the clinic for help.</span></p>}
    {error && <p role="alert" className="notice notice--danger"><Icon name="alertCircle" size={18} /><span>{error}</span></p>}
    {notice && <p role="status" className="notice notice--info"><Icon name="info" size={18} /><span>{notice}</span></p>}
    {reference && !clinic && !error && <LoadingScreen label="Loading…" />}

    {reference && clinic && (!state || verifying) && <section className="card card--pad stack stack--lg" aria-label="Verify visit email">
      <form onSubmit={(event) => void requestCode(event)} className="form">
        <TextField label="Visit email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} hint="Use the email you gave for this visit." />
        <button type="submit" className="btn btn--secondary" disabled={busy || cooldown > 0 || !email.trim()}>
          <Icon name="mail" size={18} />
          {cooldown > 0 ? `Send another code in ${cooldown}s` : challenge ? 'Send a new code' : 'Email me a code'}
        </button>
      </form>
      {challenge && <form onSubmit={(event) => void verify(event)} className="form" style={{ paddingTop: 20, borderTop: '1px solid var(--line)' }}>
        <TextField label="Six-digit code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="field--code" hint="Codes expire after 10 minutes." />
        <CtaButton type="submit" busy={busy} disabled={busy || code.length !== 6}>Verify email</CtaButton>
      </form>}
    </section>}

    {state && appointment && <>
      <AppointmentSummary appointment={appointment} encounterStatus={state.encounter.status}>
        {appointment.status === 'REQUESTED' && <p className="body">This time is provisional until the clinic confirms it.</p>}
        {!verifying && !rescheduling && !cancelling && (state.allowedActions.includes('reschedule') || state.allowedActions.includes('cancel')) && (
          <div className="cluster" style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            {state.allowedActions.includes('reschedule') && <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setRescheduling(true); setCancelling(false); }}>Request another time</button>}
            {state.allowedActions.includes('cancel') && <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => { setCancelling(true); setRescheduling(false); }}>Cancel appointment</button>}
          </div>
        )}
        {cancelling && !verifying && (
          <div className="notice notice--warn" role="group" aria-label="Cancel appointment">
            <Icon name="alertTriangle" size={18} />
            <div className="stack stack--sm" style={{ flex: 1 }}>
              <strong>Cancel this appointment?</strong>
              <div className="cluster">
                <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={() => void command('cancel')}>{busy ? 'Cancelling…' : 'Yes, cancel'}</button>
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => setCancelling(false)}>Keep appointment</button>
              </div>
            </div>
          </div>
        )}
      </AppointmentSummary>

      {rescheduling && !verifying && <section className="stack stack--lg" aria-label="Choose a new time">
        <h2 className="title">Choose a new time</h2>
        {availability ? <ClinicSlotPicker availability={availability} selected={selected} onSelect={setSelected} name="recovery-slot" /> : <LoadingScreen label="Loading open times…" />}
        <div className="stack stack--sm">
          <CtaButton busy={busy} disabled={busy || !selected} onClick={() => void command('reschedule')}>Request this time</CtaButton>
          <button type="button" className="btn btn--quiet btn--block" onClick={() => setRescheduling(false)}>Keep my current time</button>
        </div>
      </section>}

      {(state.clinic.replyTo || state.clinic.contactPhone) && <section className="card" aria-label="Contact the clinic">
        <div className="rows">
          {state.clinic.replyTo && <a className="row row--link" href={`mailto:${state.clinic.replyTo}`}><Icon name="mail" /><span className="row__main"><span className="row__key">Email the clinic</span><span className="row__value">{state.clinic.replyTo}</span></span><Icon name="chevronRight" /></a>}
          {state.clinic.contactPhone && <a className="row row--link" href={`tel:${state.clinic.contactPhone}`}><Icon name="phone" /><span className="row__main"><span className="row__key">Call the clinic</span><span className="row__value">{state.clinic.contactPhone}</span></span><Icon name="chevronRight" /></a>}
        </div>
      </section>}

      <div>
        <button type="button" className="text-btn text-btn--muted" onClick={() => void logout().catch(() => setError('We couldn’t end access. Please try again.'))}>
          <Icon name="logout" size={18} />
          End appointment access on this device
        </button>
      </div>
    </>}
  </ClinicPageFrame>;
}
