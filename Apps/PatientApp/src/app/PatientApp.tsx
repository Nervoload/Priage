// PatientApp/src/app/PatientApp.tsx
// Root app shell — handles auth gating and route rendering.

import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../shared/hooks/useAuth';
import { BottomNav } from '../shared/ui/BottomNav';
import { LoginPage } from '../auth/LoginPage';
import { SignupPage } from '../auth/SignupPage';
import { DashboardPage } from '../pages/DashboardPage';
import { PriagePage } from '../pages/PriagePage';
import { MessagesPage } from '../pages/MessagesPage';
import { ChatPage } from '../pages/ChatPage';
import { SettingsPage } from '../pages/SettingsPage';

export function PatientApp() {
  const { session, loading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  // Loading spinner while checking stored session
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading…</p>
      </div>
    );
  }

  // Not authenticated → Login / Signup
  if (!session) {
    return authView === 'login' ? (
      <LoginPage onSwitchToSignup={() => setAuthView('signup')} />
    ) : (
      <SignupPage onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  // Authenticated → Main app with routes + bottom nav
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

