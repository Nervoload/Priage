import { useEffect, useState, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { heroBackdrop, patientTheme } from '../shared/ui/theme';
import { WelcomePage } from './WelcomePage';
import { Login as GuestCheckInStart } from './Login';
import { EncounterWorkspace } from '../features/encounter-workspace/EncounterWorkspace';
import { Routing } from '../features/pre-triage/Routing';
import { GuestChatbotPage } from '../features/pre-triage/GuestChatbotPage';
import { flushPatientMessageOutbox } from '../shared/patientOutbox';

export function PatientApp() {
  const { session, loading } = useAuth();
  const { session: guestSession } = useGuestSession();

  const guestPath = resolveGuestPath(guestSession);

  useEffect(() => {
    if (!session && !guestSession) {
      return;
    }

    void flushPatientMessageOutbox();
    const timer = window.setInterval(() => {
      void flushPatientMessageOutbox();
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [guestSession, session]);

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
              ? <EncounterWorkspace />
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
  const location = useLocation();
  const navigate = useNavigate();
  const { patient } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isWideLayout, setIsWideLayout] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= 980 : false
  ));

  useEffect(() => {
    if (!isWideLayout) {
      setMenuOpen(false);
    }
  }, [isWideLayout, location.pathname, location.search]);

  useEffect(() => {
    function handleResize() {
      setIsWideLayout(window.innerWidth >= 980);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!menuOpen || isWideLayout) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isWideLayout, menuOpen]);

  const displayName = patient?.firstName || patient?.email?.split('@')[0] || 'Patient';
  const sidebarVisible = isWideLayout || menuOpen;

  function isNavActive(path: '/' | '/messages' | '/settings') {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/encounters/') || location.pathname.startsWith('/priage');
    }

    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  function openRoute(path: '/' | '/messages' | '/settings') {
    setMenuOpen(false);
    navigate(path);
  }

  return (
    <div style={styles.appContainer}>
      {!isWideLayout ? (
        <button
          type="button"
          aria-label={menuOpen ? 'Close patient navigation' : 'Open patient navigation'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
          style={{
            ...styles.menuButton,
            boxShadow: menuOpen ? '0 20px 44px rgba(20, 40, 90, 0.18)' : styles.menuButton.boxShadow,
          }}
        >
          <span style={{ ...styles.menuBar, transform: menuOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
          <span style={{ ...styles.menuBar, opacity: menuOpen ? 0 : 1, transform: menuOpen ? 'scaleX(0.5)' : 'scaleX(1)' }} />
          <span style={{ ...styles.menuBar, transform: menuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
        </button>
      ) : null}

      <div
        style={{
          ...styles.sidebarScrim,
          opacity: !isWideLayout && sidebarVisible ? 1 : 0,
          pointerEvents: !isWideLayout && sidebarVisible ? 'auto' : 'none',
        }}
        onClick={() => {
          if (!isWideLayout) {
            setMenuOpen(false);
          }
        }}
      />

      <aside
        style={{
          ...styles.sidebar,
          transform: sidebarVisible ? 'translateX(0)' : 'translateX(calc(-100% - 1.25rem))',
          top: isWideLayout ? '1.25rem' : styles.sidebar.top,
          left: isWideLayout ? '1.25rem' : styles.sidebar.left,
          bottom: isWideLayout ? '1.25rem' : styles.sidebar.bottom,
        }}
      >
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarEyebrow}>Patient App</div>
          <h2 style={styles.sidebarTitle}>{displayName}</h2>
          <p style={styles.sidebarSubtitle}>{patient?.email}</p>
        </div>

        <nav style={styles.sidebarNav}>
          <button type="button" onClick={() => openRoute('/')} style={{ ...styles.navButton, ...(isNavActive('/') ? styles.navButtonActive : null) }}>
            Home
          </button>
          <button type="button" onClick={() => openRoute('/messages')} style={{ ...styles.navButton, ...(isNavActive('/messages') ? styles.navButtonActive : null) }}>
            Messages
          </button>
          <button type="button" onClick={() => openRoute('/settings')} style={{ ...styles.navButton, ...(isNavActive('/settings') ? styles.navButtonActive : null) }}>
            Settings
          </button>
        </nav>

        <div style={styles.sidebarFooter}>
          Visit summaries, care messages, and account tools are now grouped here so the logged-in app stays focused.
        </div>
      </aside>

      <div
        style={{
          ...styles.routeArea,
          paddingLeft: isWideLayout ? '20.5rem' : 0,
          paddingTop: isWideLayout ? '1.25rem' : styles.routeArea.paddingTop,
        }}
      >
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

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    fontFamily: patientTheme.fonts.body,
    background: heroBackdrop,
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
    color: patientTheme.colors.inkMuted,
    fontSize: '0.95rem',
  },
  appContainer: {
    position: 'relative',
    minHeight: '100vh',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    overflowX: 'hidden',
  },
  menuButton: {
    position: 'fixed',
    top: '1rem',
    left: '1rem',
    zIndex: 40,
    width: '54px',
    height: '54px',
    borderRadius: '18px',
    border: '1px solid rgba(25, 73, 184, 0.12)',
    background: 'rgba(255, 253, 248, 0.96)',
    boxShadow: '0 14px 34px rgba(20, 40, 90, 0.14)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    cursor: 'pointer',
    backdropFilter: 'blur(16px)',
  },
  menuBar: {
    width: '22px',
    height: '2.5px',
    borderRadius: '999px',
    background: patientTheme.colors.accentStrong,
    transition: 'transform 180ms ease, opacity 180ms ease',
    transformOrigin: 'center',
  },
  sidebarScrim: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.28)',
    backdropFilter: 'blur(2px)',
    zIndex: 24,
    transition: 'opacity 180ms ease',
  },
  sidebar: {
    position: 'fixed',
    top: '1rem',
    left: '1rem',
    bottom: '1rem',
    zIndex: 30,
    width: 'min(84vw, 290px)',
    borderRadius: patientTheme.radius.lg,
    border: '1px solid rgba(25, 73, 184, 0.1)',
    background: 'linear-gradient(180deg, rgba(255, 253, 248, 0.98) 0%, rgba(248, 250, 255, 0.98) 100%)',
    boxShadow: '0 28px 60px rgba(20, 40, 90, 0.22)',
    padding: '4.75rem 1rem 1rem',
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    gap: '1rem',
    transition: 'transform 220ms ease',
    backdropFilter: 'blur(18px)',
  },
  sidebarHeader: {
    display: 'grid',
    gap: '0.25rem',
  },
  sidebarEyebrow: {
    fontSize: '0.74rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: patientTheme.colors.accentStrong,
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '1.18rem',
    fontFamily: patientTheme.fonts.heading,
    color: patientTheme.colors.ink,
  },
  sidebarSubtitle: {
    margin: 0,
    fontSize: '0.86rem',
    color: patientTheme.colors.inkMuted,
    wordBreak: 'break-word',
  },
  sidebarNav: {
    display: 'grid',
    alignContent: 'start',
    gap: '0.45rem',
  },
  navButton: {
    border: '1px solid transparent',
    borderRadius: patientTheme.radius.md,
    background: 'transparent',
    color: patientTheme.colors.ink,
    padding: '0.85rem 0.9rem',
    textAlign: 'left',
    fontFamily: patientTheme.fonts.body,
    fontSize: '0.98rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background-color 180ms ease, border-color 180ms ease, transform 180ms ease',
  },
  navButtonActive: {
    border: panelTintBorder(),
    background: '#edf4ff',
    color: patientTheme.colors.accentStrong,
    transform: 'translateX(2px)',
  },
  sidebarFooter: {
    borderTop: '1px solid rgba(148, 163, 184, 0.22)',
    paddingTop: '0.85rem',
    fontSize: '0.84rem',
    lineHeight: 1.5,
    color: patientTheme.colors.inkMuted,
  },
  routeArea: {
    flex: 1,
    paddingTop: '4.5rem',
    transition: 'padding-left 220ms ease',
  },
};

function panelTintBorder(): string {
  return '1px solid rgba(59, 130, 246, 0.25)';
}
