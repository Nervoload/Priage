import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/hooks/useAuth';
import { useGuestSession } from '../shared/hooks/useGuestSession';
import { BottomNav } from '../shared/ui/BottomNav';
import { LoginPage } from '../auth/LoginPage';
import { SignupPage } from '../auth/SignupPage';
import { DashboardPage } from '../pages/DashboardPage';
import { PriagePage } from '../pages/PriagePage';
import { MessagesPage } from '../pages/MessagesPage';
import { ChatPage } from '../pages/ChatPage';
import { SettingsPage } from '../pages/SettingsPage';
import { WelcomePage } from './WelcomePage';
import { Login as GuestCheckInStart } from './Login';
import { PreTriage } from '../features/pre-triage/PreTriage';
import { Enroute } from '../features/enroute/Enroute';

export function PatientApp() {
  const { session, loading } = useAuth();
  const { session: guestSession } = useGuestSession();

  const guestPath = guestSession?.encounterId
    ? `/guest/enroute/${guestSession.encounterId}`
    : guestSession
      ? '/guest/pre-triage'
      : '/welcome';

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
        element={session ? <Navigate to="/" replace /> : guestSession ? <Navigate to={guestPath} replace /> : <WelcomePage />}
      />
      <Route
        path="/auth/login"
        element={session ? <Navigate to="/" replace /> : guestSession ? <Navigate to={guestPath} replace /> : <LoginRoute />}
      />
      <Route
        path="/auth/signup"
        element={session ? <Navigate to="/" replace /> : guestSession ? <Navigate to={guestPath} replace /> : <SignupRoute />}
      />
      <Route
        path="/guest/start"
        element={session ? <Navigate to="/" replace /> : <GuestCheckInStart />}
      />
      <Route
        path="/guest/pre-triage"
        element={session ? <Navigate to="/" replace /> : guestSession ? <PreTriage /> : <Navigate to="/guest/start" replace />}
      />
      <Route
        path="/guest/enroute/:encounterId"
        element={session ? <Navigate to="/" replace /> : guestSession?.encounterId ? <Enroute /> : <Navigate to="/guest/start" replace />}
      />
      <Route
        path="/"
        element={session ? <AuthenticatedShell /> : <Navigate to={guestPath} replace />}
      />
      <Route
        path="/priage"
        element={session ? <AuthenticatedShell /> : <Navigate to={guestPath} replace />}
      />
      <Route
        path="/messages"
        element={session ? <AuthenticatedShell /> : <Navigate to={guestPath} replace />}
      />
      <Route
        path="/messages/:id"
        element={session ? <AuthenticatedShell /> : <Navigate to={guestPath} replace />}
      />
      <Route
        path="/settings"
        element={session ? <AuthenticatedShell /> : <Navigate to={guestPath} replace />}
      />
      <Route path="*" element={<Navigate to={session ? '/' : guestPath} replace />} />
    </Routes>
  );
}

function AuthenticatedShell() {
  return (
    <div style={styles.appContainer}>
      <div style={styles.routeArea}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/priage" element={<PriagePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:id" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}

function LoginRoute() {
  const navigate = useNavigate();
  return <LoginPage onSwitchToSignup={() => navigate('/auth/signup')} />;
}

function SignupRoute() {
  const navigate = useNavigate();
  return <SignupPage onSwitchToLogin={() => navigate('/auth/login')} />;
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
    background: '#f8fafc',
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
    fontSize: '0.95rem',
  },
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#f8fafc',
  },
  routeArea: {
    flex: 1,
    paddingBottom: '64px', // space for BottomNav
  },
};
