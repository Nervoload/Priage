import { ClinicAppointmentRecovery } from './ClinicAppointmentRecovery';
import { useEffect, useState, type ReactNode } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../shared/hooks/useAuth';
import { startInterview } from '../shared/api/intake';
import { useGuestSession } from '../shared/hooks/useGuestSession';
import { resolveGuestPath } from '../shared/guestFlow';
import { LoginPage } from '../auth/LoginPage';
import { SignupPage } from '../auth/SignupPage';
import { DashboardPage } from '../pages/DashboardPage';
import { PriagePage } from '../pages/PriagePage';
import { MessagesPage } from '../pages/MessagesPage';
import { ChatPage } from '../pages/ChatPage';
import { SettingsPage } from '../pages/SettingsPage';
import { LoadingScreen } from '../shared/ui/Controls';
import { AppShell } from './AppShell';
import { WelcomePage } from './WelcomePage';
import { Login as GuestCheckInStart } from './Login';
import { EncounterWorkspace } from '../features/encounter-workspace/EncounterWorkspace';
import { Routing } from '../features/pre-triage/Routing';
import { GuestChatbotPage } from '../features/pre-triage/GuestChatbotPage';
import { flushPatientMessageOutbox } from '../shared/patientOutbox';
import { flushPatientCommandOutbox } from '../shared/patientCommandOutbox';
import { ClinicDirectStart, ClinicPatientPreview, ClinicVisit, DeskAssessment } from './ClinicPatientPreview';
import { ClinicLegalDocument } from './ClinicBooking';

export function PatientApp() {
  const { session, loading } = useAuth();
  const { session: guestSession } = useGuestSession();

  const guestPath = resolveGuestPath(guestSession);

  useEffect(() => {
    if (!session && !guestSession) {
      return;
    }

    void flushPatientMessageOutbox();
    void flushPatientCommandOutbox();
    const timer = window.setInterval(() => {
      void flushPatientMessageOutbox();
      void flushPatientCommandOutbox();
    }, 30_000);
    const handleOnline = () => {
      void flushPatientMessageOutbox();
      void flushPatientCommandOutbox();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', handleOnline);
    };
  }, [guestSession, session]);

  if (loading) {
    return <LoadingScreen full />;
  }

  if (import.meta.env.VITE_CLINIC_PILOT_MODE === 'true') {
    return <ClinicPatientPreview />;
  }

  return (
    <Routes>
      <Route path="/:alias/start" element={<ClinicDirectStart />} />
      <Route path="/:alias/appointment" element={<ClinicAppointmentRecovery />} />
      <Route path="/:alias/walk-in" element={<DeskAssessment />} />
      <Route path="/clinic/:alias/visits/:id" element={<ClinicVisit />} />
      <Route path="/clinic/:alias/terms" element={<ClinicLegalDocument kind="terms" />} />
      <Route path="/clinic/:alias/privacy" element={<ClinicLegalDocument kind="privacy" />} />
      <Route
        path="/welcome"
        element={session ? <Navigate to="/" replace /> : <WelcomePage />}
      />
      <Route
        path="/auth/login"
        element={<LoginRoute backPath="/welcome" />}
      />
      <Route
        path="/auth/signup"
        element={<SignupRoute backPath="/welcome" />}
      />
      <Route
        path="/guest/start"
        element={session ? <Navigate to="/" replace /> : <GuestCheckInStart />}
      />
      <Route
        path="/guest/chatbot"
        element={
          session
            ? <Navigate to="/" replace />
            : guestSession
              ? <GuestChatbotRoute />
              : <Navigate to="/guest/start" replace />
        }
      />
      <Route
        path="/guest/routing"
        element={
          session
            ? <Navigate to="/" replace />
            : guestSession?.hospitalSlug && guestSession.encounterId
              ? <Navigate to={guestPath} replace />
              : guestSession
                ? <GuestRoutingRoute />
                : <Navigate to="/guest/start" replace />
        }
      />
      <Route
        path="/guest/pre-triage"
        element={session ? <Navigate to="/" replace /> : guestSession ? <Navigate to={guestPath} replace /> : <Navigate to="/guest/start" replace />}
      />
      <Route
        path="/guest/enroute/:encounterId"
        element={
          session
            ? <Navigate to="/" replace />
            : guestSession?.hospitalSlug && guestSession.encounterId
              ? <GuestEncounterRedirect />
              : <Navigate to="/guest/start" replace />
        }
      />
      <Route
        path="/encounters/:id/*"
        element={
          session
            ? <AuthenticatedShell><EncounterWorkspace /></AuthenticatedShell>
            : guestSession?.encounterId
              ? <AppShell variant="guest"><EncounterWorkspace /></AppShell>
              : <Navigate to={guestPath} replace />
        }
      />
      <Route
        path="/messages"
        element={
          session
            ? <AuthenticatedShell><MessagesPage /></AuthenticatedShell>
            : guestSession?.encounterId
              ? <AppShell variant="guest"><MessagesPage /></AppShell>
              : <Navigate to={guestPath} replace />
        }
      />
      <Route
        path="/messages/:id"
        element={
          session
            ? <AuthenticatedShell><ChatPage /></AuthenticatedShell>
            : guestSession?.encounterId
              ? <ChatPage />
              : <Navigate to={guestPath} replace />
        }
      />
      <Route
        path="/*"
        element={
          session
            ? <AuthenticatedShell />
            : <Navigate to={guestPath} replace />
        }
      />
      <Route path="*" element={<Navigate to={session ? '/' : '/welcome'} replace />} />
    </Routes>
  );
}

function resolveSafeReturnTo(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function AuthenticatedShell({ children }: { children?: ReactNode }) {
  return (
    <AppShell variant="account">
      {children ?? (
        <Routes>
          <Route index element={<HomeRoute />} />
          <Route path="priage" element={<PriagePage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="messages/:id" element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="encounters/:id/*" element={<EncounterWorkspace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </AppShell>
  );
}

function LoginRoute({ backPath }: { backPath: string }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get('returnTo'));

  if (session) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <LoginPage
      onSwitchToSignup={() => {
        const nextSearch = searchParams.toString();
        navigate(`/auth/signup${nextSearch ? `?${nextSearch}` : ''}`);
      }}
      onBack={() => navigate(backPath)}
    />
  );
}

function SignupRoute({ backPath }: { backPath: string }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get('returnTo'));

  if (session) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <SignupPage
      onSwitchToLogin={() => {
        const nextSearch = searchParams.toString();
        navigate(`/auth/login${nextSearch ? `?${nextSearch}` : ''}`);
      }}
      onBack={() => navigate(backPath)}
    />
  );
}

function GuestRoutingRoute() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function verifyInterview() {
      try {
        const interview = await startInterview();
        if (cancelled) {
          return;
        }
        if (interview.status === 'complete') {
          setAllowed(true);
        } else {
          navigate('/guest/chatbot', { replace: true });
        }
      } catch {
        if (!cancelled) {
          navigate('/guest/chatbot', { replace: true });
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    void verifyInterview();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checking) {
    return <LoadingScreen full label="Loading care locations…" />;
  }

  if (!allowed) {
    return null;
  }

  return <Routing onConfirmed={(encounterId, clinicAlias) => navigate(clinicAlias ? `/clinic/${clinicAlias}/visits/${encounterId}` : `/guest/enroute/${encounterId}`, clinicAlias ? { state: { assessmentReviewed: true } } : undefined)} onBack={() => navigate('/guest/chatbot')} />;
}

function GuestChatbotRoute() {
  const navigate = useNavigate();
  return <GuestChatbotPage onChooseHospital={() => navigate('/guest/routing')} onBack={() => navigate('/guest/start')} />;
}

function GuestEncounterRedirect() {
  const { encounterId } = useParams<{ encounterId: string }>();

  if (!encounterId) {
    return <Navigate to="/guest/start" replace />;
  }

  return <Navigate to={`/encounters/${encounterId}/current`} replace />;
}

function HomeRoute() {
  return <DashboardPage />;
}
