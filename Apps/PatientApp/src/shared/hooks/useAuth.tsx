// Auth context — manages patient session state across the app.

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { PatientSession, PatientProfile, RegisterPayload, LoginPayload } from '../types/domain';
import { registerPatient, loginPatient, logout as logoutApi, getMe } from '../api/auth';

const STORAGE_KEY = 'patientSession';

interface AuthContextValue {
  session: PatientSession | null;
  patient: PatientProfile | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updatePatient: (profile: PatientProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): PatientSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveSession(session: PatientSession | null) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PatientSession | null>(loadSession);
  const [patient, setPatient] = useState<PatientProfile | null>(session?.patient ?? null);
  const [loading, setLoading] = useState(!!session);

  // On mount, validate session by fetching profile
  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function validate() {
      try {
        const profile = await getMe();
        if (!cancelled) {
          setPatient(profile);
          setSession(prev => prev ? { ...prev, patient: profile } : null);
        }
      } catch {
        // Session invalid
        if (!cancelled) {
          setSession(null);
          setPatient(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    validate();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist session changes
  useEffect(() => {
    saveSession(session);
  }, [session]);

  // Listen for session-expired events
  useEffect(() => {
    function handleExpired() {
      setSession(null);
      setPatient(null);
      localStorage.removeItem(STORAGE_KEY);
    }
    window.addEventListener('patient-session-expired', handleExpired);
    return () => window.removeEventListener('patient-session-expired', handleExpired);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await loginPatient(payload);
    const newSession: PatientSession = {
      sessionToken: result.sessionToken,
      patientId: result.patient.id,
      patient: result.patient,
    };
    // Persist to localStorage BEFORE setting state so child components
    // that mount during the re-render can read the token immediately.
    saveSession(newSession);
    setSession(newSession);
    setPatient(result.patient);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const result = await registerPatient(payload);
    const newSession: PatientSession = {
      sessionToken: result.sessionToken,
      patientId: result.patient.id,
      patient: result.patient,
    };
    saveSession(newSession);
    setSession(newSession);
    setPatient(result.patient);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setSession(null);
    setPatient(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await getMe();
      setPatient(profile);
      setSession(prev => prev ? { ...prev, patient: profile } : null);
    } catch {
      // ignore
    }
  }, []);

  const updatePatient = useCallback((profile: PatientProfile) => {
    setPatient(profile);
    setSession(prev => prev ? { ...prev, patient: profile } : null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, patient, loading, login, register, logout, refreshProfile, updatePatient }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
