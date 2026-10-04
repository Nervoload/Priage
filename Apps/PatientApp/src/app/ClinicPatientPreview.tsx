import { ClinicAppointmentRecovery } from './ClinicAppointmentRecovery';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

import { LoginPage } from '../auth/LoginPage';
import { SignupPage } from '../auth/SignupPage';
import { SettingsPage } from '../pages/SettingsPage';
import { useAuth } from '../shared/hooks/useAuth';
import { API_BASE_URL, ApiError, client } from '../shared/api/client';
import { friendlyError } from '../shared/api/errors';
import type { AdvanceInterviewPayload, InterviewState } from '../shared/types/domain';
import { GuestChatbotPage } from '../features/pre-triage/GuestChatbotPage';
import { CtaButton, LoadingScreen } from '../shared/ui/Controls';
import { TextField } from '../shared/ui/Field';
import { Icon } from '../shared/ui/Icon';
import { ClinicBooking, ClinicLegalDocument, type ClinicVisitState } from './ClinicBooking';
import { ClinicJourney, ClinicPageFrame } from './ClinicPageFrame';
import { ClinicQuestionsStep } from './ClinicQuestionsStep';
import { Login as IntakeStartForm, type VisitStartDetails } from './Login';

type Clinic = { id: number; name: string; preview: true; appointmentBookingAvailable: boolean; alias?: string };

// Lets a guest who returns to the start page in the same tab get back to their visit.
const LAST_VISIT_KEY = 'priage-clinic-last-visit';

function readLastVisitPath(): string | null {
  try {
    const value = sessionStorage.getItem(LAST_VISIT_KEY);
    return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
  } catch {
    return null;
  }
}
type Visit = { id: number; status: string; chiefComplaint: string; contactEmail?: string; interviewStatus?: string };

export function ClinicPatientPreview() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  return <Routes>
    <Route path="/" element={<ClinicStart account={!!session} onLogout={() => void logout()} />} />
    <Route path="/:alias/start" element={<ClinicDirectStart />} />
    <Route path="/:alias/appointment" element={<ClinicAppointmentRecovery />} />
    <Route path="/:alias/walk-in" element={<DeskAssessment />} />
    <Route path="/clinic/:alias/visits/:id" element={<ClinicVisit />} />
    <Route path="/clinic/:alias/terms" element={<ClinicLegalDocument kind="terms" />} />
    <Route path="/clinic/:alias/privacy" element={<ClinicLegalDocument kind="privacy" />} />
    <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage onSwitchToSignup={() => navigate('/signup')} onBack={() => navigate('/')} />} />
    <Route path="/signup" element={session ? <Navigate to="/" replace /> : <SignupPage onSwitchToLogin={() => navigate('/login')} onBack={() => navigate('/')} />} />
    <Route path="/visits/:id" element={<ClinicVisit />} />
    <Route path="/walk-in" element={<DeskAssessment />} />
    <Route path="/terms" element={<ClinicLegalDocument kind="terms" />} />
    <Route path="/privacy" element={<ClinicLegalDocument kind="privacy" />} />
    <Route path="/account" element={session ? <ClinicAccount /> : <Navigate to="/login" replace />} />
    <Route path="/account/settings" element={session ? <ClinicAccountSettings /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

export function ClinicDirectStart() {
  const { alias } = useParams();
  const { session, logout } = useAuth();
  return <ClinicStart account={!!session} onLogout={() => void logout()} alias={alias} />;
}

function ClinicStart({ account, onLogout, alias }: { account: boolean; onLogout: () => void; alias?: string }) {
  const navigate = useNavigate();
  const { patient } = useAuth();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setClinic(null); setError('');
    void client<Clinic>(alias ? `/clinic-intake/entry/${alias}` : '/clinic-intake/clinic').then((result) => {
      if (!active) return;
      if (alias && result.alias && result.alias !== alias) { navigate(`/${result.alias}/start`, { replace: true }); return; }
      setClinic(result);
    }).catch(() => { if (active) setError('This clinic isn’t taking online visits on this site right now.'); });
    return () => { active = false; };
  }, [alias, navigate]);

  async function start(details: VisitStartDetails) {
    if (!clinic || (alias && clinic.alias !== alias)) return;
    const storageKey = `clinic-start-key-${alias || 'pinned'}`;
    const startKey = sessionStorage.getItem(storageKey) || crypto.randomUUID();
    sessionStorage.setItem(storageKey, startKey);
    const base = alias ? `/clinic-intake/entry/${alias}/visits` : '/clinic-intake/visits';
    let visit: Visit;
    try {
      visit = await client<Visit>(`${base}/${account ? 'account' : 'guest'}`, {
        method: 'POST', body: JSON.stringify({ startKey, ...details }),
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) sessionStorage.removeItem(storageKey);
      throw cause;
    }
    sessionStorage.removeItem(storageKey);
    const visitPath = alias ? `/clinic/${alias}/visits/${visit.id}` : `/visits/${visit.id}`;
    try { sessionStorage.setItem(LAST_VISIT_KEY, visitPath); } catch { /* resume shortcut is optional */ }
    navigate(visitPath);
  }

  if (!clinic) {
    return (
      <ClinicPageFrame title={error ? 'Online visits unavailable' : 'Start a clinic visit'}>
        {error
          ? <p role="alert" className="notice"><Icon name="info" size={18} /><span>{error} Contact the clinic directly for help.</span></p>
          : <LoadingScreen label="Loading clinic details…" />}
      </ClinicPageFrame>
    );
  }
  const pilot = import.meta.env.VITE_CLINIC_PILOT_MODE === 'true';
  const lastVisitPath = readLastVisitPath();
  const signInActions = account
    ? (
      <div className="cluster" style={{ '--cluster-gap': '4px' } as React.CSSProperties}>
        <Link className="text-btn" to={pilot ? '/account' : '/settings'}>Your account</Link>
        <button type="button" className="text-btn text-btn--muted" onClick={onLogout}>Sign out</button>
      </div>
    )
    : (
      <p className="body">
        Have an account?{' '}
        <Link to={alias && !pilot ? `/auth/login?returnTo=${encodeURIComponent(`/${alias}/start`)}` : '/login'}>Sign in</Link>
        {' '}or{' '}
        <Link to={alias && !pilot ? `/auth/signup?returnTo=${encodeURIComponent(`/${alias}/start`)}` : '/signup'}>create one</Link>.
        {' '}You can also continue as a guest.
      </p>
    );
  const authActions = (
    <>
      {signInActions}
      {lastVisitPath && (
        <Link to={lastVisitPath} className="link-card">
          <span className="tile__icon"><Icon name="clock" /></span>
          <span className="row__main">
            <span className="heading">Return to your visit</span>
            <span className="small">See its status or change your time.</span>
          </span>
          <Icon name="chevronRight" />
        </Link>
      )}
    </>
  );
  return <IntakeStartForm key={`${clinic.id}:${account ? `account-${patient?.id}` : 'guest'}`} clinic={{
    name: clinic.name, bookingAvailable: clinic.appointmentBookingAvailable, account, authActions, onStart: start,
    initialDetails: account ? {
      firstName: patient?.firstName ?? '', lastName: patient?.lastName ?? '', phone: patient?.phone ?? '',
      contactEmail: patient?.email ?? '', age: patient?.age ?? undefined, gender: patient?.gender ?? '',
    } : undefined,
  }} />;
}

function visitHeadline(state: ClinicVisitState): { title: string; lede: string } {
  switch (state.encounter.status) {
    case 'INTAKE':
      return state.clinicQuestions === 'pending'
        ? { title: 'A few questions first', lede: 'The clinic asks every patient these before you choose a time.' }
        : { title: 'Choose a time', lede: 'Pick a time to request. The clinic confirms it before it’s booked.' };
    case 'REQUESTED':
      return { title: 'Waiting for the clinic to confirm', lede: 'Your answers and requested time are with the clinic. We’ll email you as soon as it’s confirmed.' };
    case 'EXPECTED':
      return { title: 'Your visit is confirmed', lede: 'See you soon. Check in at the front desk when you arrive.' };
    case 'ADMITTED':
      return { title: 'You’re checked in', lede: 'The clinic team will be with you shortly.' };
    case 'CARE':
      return { title: 'With your clinician', lede: 'Your clinician has your answers in front of them.' };
    case 'COMPLETE':
      return { title: 'Visit complete', lede: 'Thanks for visiting. Contact the clinic if anything changes.' };
    default:
      return { title: 'This visit has ended', lede: 'Contact the clinic if you still need care.' };
  }
}

export function ClinicVisit() {
  const { id, alias } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<ClinicVisitState | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [contactError, setContactError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [showBooking, setShowBooking] = useState(() => Boolean((location.state as { assessmentReviewed?: boolean } | null)?.assessmentReviewed));
  const applyState = useCallback((next: ClinicVisitState) => setState((current) => {
    if (!current || current.encounter.id !== next.encounter.id) return next;
    const currentTime = Date.parse(current.encounter.updatedAt);
    const nextTime = Date.parse(next.encounter.updatedAt);
    if (nextTime < currentTime || (nextTime === currentTime && next.revision < current.revision)) return current;
    return next;
  }), []);
  const refreshVisit = useCallback(async () => {
    if (!id) return;
    const next = await client<ClinicVisitState>(`/clinic-intake/visits/${id}/state`);
    applyState(next);
    setError('');
  }, [id, applyState]);
  const startClinicInterview = useCallback(() => client<InterviewState>(`/clinic-intake/visits/${id}/interview/start`, { method: 'POST', body: '{}' }), [id]);
  const advanceClinicInterview = useCallback((payload: AdvanceInterviewPayload) => client<InterviewState>(`/clinic-intake/visits/${id}/interview/advance`, { method: 'POST', body: JSON.stringify(payload) }), [id]);
  useEffect(() => setShowBooking(Boolean((location.state as { assessmentReviewed?: boolean } | null)?.assessmentReviewed)), [id, location.state]);
  useEffect(() => {
    if (!id) return;
    void refreshVisit().catch(() => setError('We couldn’t open this visit. Sign in, or use the browser where you started it.'));
    const update = () => void refreshVisit().catch(() => {});
    const timer = window.setInterval(update, 15_000);
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    const events = typeof EventSource !== 'undefined' ? new EventSource(`${API_BASE_URL}/patient/encounters/${id}/events`, { withCredentials: true }) : null;
    events?.addEventListener('encounter.updated', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('online', update); events?.close(); };
  }, [id, refreshVisit]);
  useEffect(() => { if (state?.contactEmail) setEmail(state.contactEmail); }, [state?.contactEmail]);
  const displayedState = state?.encounter.id === Number(id) ? state : null;
  const canonicalAlias = displayedState?.canonicalAlias;
  useEffect(() => {
    if (alias && canonicalAlias && alias !== canonicalAlias) {
      navigate(`/clinic/${canonicalAlias}/visits/${id}`, { replace: true, state: { assessmentReviewed: showBooking } });
    }
  }, [alias, canonicalAlias, id, navigate, showBooking]);
  async function saveContact(event: FormEvent) {
    event.preventDefault();
    if (!id || savingContact) return;
    setSavingContact(true);
    try {
      await client(`/clinic-intake/visits/${id}/contact`, { method: 'PATCH', body: JSON.stringify({ email }) });
      await refreshVisit();
      setSaved(true); setContactError('');
    } catch (cause) { setContactError(friendlyError(cause, 'We couldn’t update your email. Please try again.')); }
    finally { setSavingContact(false); }
  }
  if (alias && canonicalAlias && alias !== canonicalAlias) {
    return <ClinicPageFrame title="Your clinic visit"><LoadingScreen label="Opening your visit…" /></ClinicPageFrame>;
  }
  if (displayedState?.encounter.status === 'INTAKE' && (!showBooking || displayedState.interviewStatus !== 'complete')) {
    return <GuestChatbotPage mode="clinic" startInterviewFn={startClinicInterview} advanceInterviewFn={advanceClinicInterview} chiefComplaint={displayedState.encounter.chiefComplaint} onChooseHospital={() => { setShowBooking(true); void refreshVisit(); }} completion={{ badge: 'Assessment complete', title: 'Your answers are ready', description: 'Next, choose a time that works for you. The clinic reviews your answers before your visit.', actionLabel: 'Choose a time' }} />;
  }
  const headline = displayedState ? visitHeadline(displayedState) : { title: 'Your clinic visit', lede: '' };
  const contactEditable = displayedState ? ['INTAKE', 'REQUESTED', 'EXPECTED'].includes(displayedState.encounter.status) : false;
  return <ClinicPageFrame title={headline.title} lede={headline.lede || undefined}>
    {error && <p role="alert" className="notice notice--danger"><Icon name="alertCircle" size={18} /><span>{error}</span></p>}
    {!displayedState && !error && <LoadingScreen label="Loading your visit…" />}
    {displayedState && <>
      {displayedState.interviewStatus === 'complete' && (displayedState.clinicQuestions === 'pending' && displayedState.encounter.status === 'INTAKE'
        ? <ClinicQuestionsStep encounterId={displayedState.encounter.id} onAnswered={refreshVisit} />
        : <ClinicBooking encounterId={displayedState.encounter.id} state={displayedState} onState={applyState} onRefresh={refreshVisit} alias={alias} />)}

      <section className="card card--pad stack" aria-label="Visit progress">
        <div className="stack stack--xs">
          <span className="heading">{displayedState.encounter.chiefComplaint || 'Your visit'}</span>
          <span className="small">Visit number {displayedState.encounter.id}</span>
        </div>
        <ClinicJourney status={displayedState.encounter.status} interviewStatus={displayedState.interviewStatus || undefined} />
      </section>

      <section className="card card--pad stack" aria-label="Visit email">
        {contactEditable ? (
          <form onSubmit={(event) => void saveContact(event)} className="form" noValidate>
            <TextField
              label="Email for visit updates"
              type="email"
              required
              value={email}
              onChange={(event) => { setEmail(event.target.value); setSaved(false); }}
              autoComplete="email"
              error={contactError}
              hint={displayedState.contactVerified ? 'Verified. You can still change it before you arrive.' : 'Not verified yet. Check it’s right so you don’t miss your confirmation.'}
            />
            <div className="cluster">
              <button type="submit" className="btn btn--secondary btn--sm" disabled={savingContact || !email.trim() || email.trim() === displayedState.contactEmail}>
                {savingContact ? 'Saving…' : 'Save email'}
              </button>
              {saved && <span role="status" className="small" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)' }}><Icon name="check" size={15} />Saved</span>}
            </div>
          </form>
        ) : (
          <div className="stack stack--xs">
            <span className="row__key">Email for visit updates</span>
            <span className="row__value">{email || 'Not provided'}</span>
          </div>
        )}
      </section>
    </>}
  </ClinicPageFrame>;
}

export function DeskAssessment() {
  const { alias } = useParams();
  const navigate = useNavigate();
  const deskBase = alias ? `/clinic-intake/entry/${alias}/desk` : '/clinic-intake/desk';
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [finished, setFinished] = useState(false);
  const [opening, setOpening] = useState(false);
  const openingRef = useRef<Promise<void> | null>(null);
  const linkHadTokenRef = useRef<boolean | null>(null);
  const startDeskInterview = useCallback(() => client<InterviewState>(`${deskBase}/interview/start`, { method: 'POST', body: '{}' }), [deskBase]);
  const advanceDeskInterview = useCallback((payload: AdvanceInterviewPayload) => client<InterviewState>(`${deskBase}/interview/advance`, { method: 'POST', body: JSON.stringify(payload) }), [deskBase]);
  useEffect(() => {
    let active = true;
    async function open() {
      if (alias) {
        const entry = await client<Clinic>(`/clinic-intake/entry/${alias}`);
        if (entry.alias && entry.alias !== alias) {
          navigate(`/${entry.alias}/walk-in${window.location.hash}`, { replace: true });
          return;
        }
      }
      const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
      window.history.replaceState(null, '', window.location.pathname);
      if (!token) await client(`${deskBase}/interview/start`, { method: 'POST', body: '{}' });
      else await client(`${deskBase}/exchange`, { method: 'POST', body: JSON.stringify({ token }) });
    }
    if (linkHadTokenRef.current === null) linkHadTokenRef.current = new URLSearchParams(window.location.hash.slice(1)).has('token');
    if (!openingRef.current) openingRef.current = open();
    void openingRef.current.then(() => { if (active) setReady(true); }).catch(() => {
      // Opening the page without a code just means there is no session to resume yet.
      if (active && linkHadTokenRef.current) setError('This desk code has expired, belongs to another clinic, or was already used. Ask Reception for another.');
    });
    return () => { active = false; };
  }, [alias, deskBase, navigate]);
  async function exchangeCode(event: FormEvent) {
    event.preventDefault();
    setOpening(true);
    try {
      await client(`${deskBase}/exchange`, { method: 'POST', body: JSON.stringify({ token: code.trim() }) });
      setError(''); setCode(''); setReady(true);
    } catch { setError('This code has expired or was already used. Ask Reception for another.'); }
    finally { setOpening(false); }
  }
  if (ready && !finished) return <GuestChatbotPage mode="clinic" counter={null} startInterviewFn={startDeskInterview} advanceInterviewFn={advanceDeskInterview} onChooseHospital={() => setFinished(true)} completion={{ badge: 'Assessment complete', title: 'Thanks — you’re all set', description: 'Your answers are with the clinic team for this visit.', actionLabel: 'Finish' }} />;
  return <ClinicPageFrame
    title={finished ? 'You’re all set' : 'Walk-in assessment'}
    lede={finished ? 'The clinic team can now see your answers. Please return to the front desk.' : 'Enter the code from the front desk. Your answers go only to the visit Reception created for you.'}
  >
    {error && <p role="alert" className="notice notice--danger"><Icon name="alertCircle" size={18} /><span>{error}</span></p>}
    {!ready && !finished && (
      <form onSubmit={(event) => void exchangeCode(event)} className="card card--pad form">
        <TextField
          label="Desk code"
          required
          minLength={8}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="field--code"
        />
        <CtaButton type="submit" busy={opening} disabled={opening || code.trim().length < 8}>Open my questions</CtaButton>
      </form>
    )}
  </ClinicPageFrame>;
}


function ClinicAccount() {
  const { patient, logout } = useAuth();
  return <ClinicPageFrame title="Your account" lede="Your login is separate from the email you give for each visit.">
    <section className="card" aria-label="Account">
      <div className="rows">
        <div className="row">
          <span className="row__main">
            <span className="row__key">Signed in as</span>
            <span className="row__value">{patient?.email || 'Patient account'}</span>
          </span>
        </div>
        <Link to="/account/settings" className="row row--link">
          <Icon name="user" />
          <span className="row__main"><span className="row__value">Details, password and account deletion</span></span>
          <Icon name="chevronRight" />
        </Link>
        <Link to="/terms" className="row row--link">
          <Icon name="document" />
          <span className="row__main"><span className="row__value">Terms of Service</span></span>
          <Icon name="chevronRight" />
        </Link>
        <Link to="/privacy" className="row row--link">
          <Icon name="shield" />
          <span className="row__main"><span className="row__value">Privacy Policy</span></span>
          <Icon name="chevronRight" />
        </Link>
      </div>
    </section>
    <div>
      <button type="button" className="btn btn--secondary" onClick={() => void logout()}>
        <Icon name="logout" size={18} />
        Sign out
      </button>
    </div>
  </ClinicPageFrame>;
}

function ClinicAccountSettings() {
  return <div className="screen">
    <header className="site-header">
      <Link to="/account" className="text-btn"><Icon name="chevronLeft" size={18} />Back to your account</Link>
    </header>
    <SettingsPage />
  </div>;
}
