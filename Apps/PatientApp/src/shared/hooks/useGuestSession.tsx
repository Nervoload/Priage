import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { clearAllPatientSessions, loadGuestSession, saveGuestSession } from '../session';
import type { GuestIntakeSession } from '../types/domain';

interface GuestSessionContextValue {
  session: GuestIntakeSession | null;
  setSession: (session: GuestIntakeSession | null) => void;
  clearSession: () => void;
}

const GuestSessionContext = createContext<GuestSessionContextValue | null>(null);

export function GuestSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<GuestIntakeSession | null>(loadGuestSession);

  useEffect(() => {
    function handleExpired() {
      setSessionState(null);
      clearAllPatientSessions();
    }

    window.addEventListener('patient-session-expired', handleExpired);
    return () => window.removeEventListener('patient-session-expired', handleExpired);
  }, []);

  const setSession = useCallback((nextSession: GuestIntakeSession | null) => {
    setSessionState(nextSession);
    saveGuestSession(nextSession);
  }, []);

  const clearSession = useCallback(() => {
    setSessionState(null);
    saveGuestSession(null);
  }, []);

  const value = useMemo(() => ({
    session,
    setSession,
    clearSession,
  }), [session, setSession, clearSession]);

  return (
    <GuestSessionContext.Provider value={value}>
      {children}
    </GuestSessionContext.Provider>
  );
}

export function useGuestSession(): GuestSessionContextValue {
  const ctx = useContext(GuestSessionContext);
  if (!ctx) {
    throw new Error('useGuestSession must be used within GuestSessionProvider');
  }
  return ctx;
}
