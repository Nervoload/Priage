import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../shared/hooks/useAuth';
import { startInterview } from '../shared/api/intake';
import { useGuestSession } from '../shared/hooks/useGuestSession';
import { resolveGuestPath } from '../shared/guestFlow';
import { isActiveEncounter } from '../shared/encounters';
import { listMyEncounters } from '../shared/api/encounters';
import { LoginPage } from '../auth/LoginPage';
import { SignupPage } from '../auth/SignupPage';
import { DashboardPage } from '../pages/DashboardPage';
import { PriagePage } from '../pages/PriagePage';
import { ChatPage } from '../pages/ChatPage';
import { SettingsPage } from '../pages/SettingsPage';
import { WelcomePage } from './WelcomePage';
import { Login as GuestCheckInStart } from './Login';
import { Enroute } from '../features/enroute/Enroute';
import { EncounterWorkspace } from '../features/encounter-workspace/EncounterWorkspace';
import { Routing } from '../features/pre-triage/Routing';
import { GuestChatbotPage } from '../features/pre-triage/GuestChatbotPage';
import type { EncounterSummary } from '../shared/types/domain';

export function PatientApp() {
  const { session, loading } = useAuth();
  const { session: guestSession } = useGuestSession();

  const guestPath = resolveGuestPath(guestSession);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading…</p>
      </div>
    );
  }

  return (
    <Routes>
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
              ? <Navigate to={`/guest/enroute/${guestSession.encounterId}`} replace />
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
              ? <Enroute />
              : <Navigate to="/guest/start" replace />
        }
      />
      <Route
        path="/*"
        element={session ? <AuthenticatedShell /> : <Navigate to="/welcome" replace />}
      />
    </Routes>
  );
}

function resolveSafeReturnTo(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function AuthenticatedShell() {
  const navigate = useNavigate();
  const { patient, logout: doLogout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName =
    [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') ||
    patient?.email?.split('@')[0] ||
    'Patient';

  const initial = (patient?.firstName?.[0] ?? patient?.email?.[0] ?? '?').toUpperCase();

  async function handleLogout() {
    setLoggingOut(true);
    try { await doLogout(); } catch { /* auth context clears state */ }
    finally { setLoggingOut(false); }
  }

  return (
    <div style={styles.appContainer}>
      {/* Top bar */}
      <header style={styles.topBar}>
        <button style={styles.topBarLeft} onClick={() => navigate('/')}>
          <div style={styles.topBarAvatar}>{initial}</div>
          <span style={styles.topBarName}>{displayName}</span>
        </button>
        <div style={styles.topBarRight}>
          <button style={styles.topBarIcon} onClick={() => navigate('/settings')} title="Settings">
            ⚙️
          </button>
          <button
            style={styles.topBarLogout}
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? '…' : 'Log out'}
          </button>
        </div>
      </header>
      <div style={styles.routeArea}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/priage" element={<PriagePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/encounters/:id/chat" element={<ChatPage />} />
          <Route path="/encounters/:id/*" element={<EncounterWorkspace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
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
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading hospital selection…</p>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <Routing onConfirmed={(encounterId) => navigate(`/guest/enroute/${encounterId}`)} onBack={() => navigate('/guest/chatbot')} />;
}

function GuestChatbotRoute() {
  const navigate = useNavigate();
  return <GuestChatbotPage onChooseHospital={() => navigate('/guest/routing')} onBack={() => navigate('/guest/start')} />;
}

function HomeRoute() {
  const [loading, setLoading] = useState(true);
  const [activeEncounterId, setActiveEncounterId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveHomeDestination() {
      try {
        const encounters = await listMyEncounters();
        if (cancelled) return;
        const active = encounters.find((encounter: EncounterSummary) => isActiveEncounter(encounter.status));
        setActiveEncounterId(active?.id ?? null);
      } catch {
        if (!cancelled) {
          setActiveEncounterId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void resolveHomeDestination();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading dashboard…</p>
      </div>
    );
  }

  if (activeEncounterId) {
    return <Navigate to={`/encounters/${activeEncounterId}/current`} replace />;
  }

  return <DashboardPage />;
}

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: 'radial-gradient(circle at top, rgba(25,73,184,0.12) 0%, rgba(248,250,252,1) 44%, rgba(241,245,249,1) 100%)',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTopColor: '#1e3a5f',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '0.92rem',
    fontWeight: 600,
  },
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#f8fafc',
  },
  routeArea: {
    flex: 1,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.7rem 1rem',
    background: 'rgba(255,255,255,0.93)',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 18px 40px -34px rgba(15,23,42,0.55)',
    backdropFilter: 'blur(10px)',
    position: 'sticky',
    top: 0,
    zIndex: 90,
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.62rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  topBarAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1949b8 0%, #3b82f6 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.78rem',
    boxShadow: '0 14px 28px -18px rgba(25,73,184,0.85)',
  },
  topBarName: {
    fontWeight: 600,
    fontSize: '0.88rem',
    color: '#14213d',
    letterSpacing: '-0.01em',
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  topBarIcon: {
    border: 'none',
    background: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0.25rem',
    lineHeight: 1,
  },
  topBarLogout: {
    border: '1px solid #fee2e2',
    background: '#fff1f2',
    color: '#9f1239',
    fontWeight: 600,
    fontSize: '0.76rem',
    cursor: 'pointer',
    padding: '0.38rem 0.66rem',
    borderRadius: '10px',
    transition: 'all 0.15s ease',
  },
};
