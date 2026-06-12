// Auth context — manages patient session state across the app.

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type {
  AuthenticatedPatientSession,
  PatientProfile,
  RegisterPayload,
  LoginPayload,
  UpgradeGuestPayload,
} from '../types/domain';
import { registerPatient, loginPatient, logout as logoutApi, getMe, upgradeGuestAccount } from '../api/auth';
import { PATIENT_SESSION_EXPIRED_EVENT } from '../api/client';
import { clearAuthSession, clearGuestSessionStorage, loadAuthSession, saveAuthSession } from '../session';

interface AuthContextValue {
  session: AuthenticatedPatientSession | null;
  patient: PatientProfile | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  upgradeFromGuest: (payload: UpgradeGuestPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
  refreshProfile: () => Promise<void>;
  updatePatient: (profile: PatientProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isGuestPlaceholderProfile(profile: PatientProfile): boolean {
  return profile.email.endsWith('@intake.local');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthenticatedPatientSession | null>(loadAuthSession);
  const [patient, setPatient] = useState<PatientProfile | null>(session?.patient ?? null);
  const [loading, setLoading] = useState(!!session);

  const clearSession = useCallback(() => {
    setSession(null);
    setPatient(null);
    clearAuthSession();
  }, []);

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
          if (isGuestPlaceholderProfile(profile)) {
            clearSession();
            return;
          }
          setPatient(profile);
          setSession(prev => prev ? { ...prev, patient: profile } : null);
        }
      } catch {
        // Session invalid
        if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    validate();
    return () => { cancelled = true; };
  }, [clearSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist session changes
  useEffect(() => {
    saveAuthSession(session);
  }, [session]);

  // Listen for session-expired events
  useEffect(() => {
    window.addEventListener(PATIENT_SESSION_EXPIRED_EVENT, clearSession);
    return () => window.removeEventListener(PATIENT_SESSION_EXPIRED_EVENT, clearSession);
  }, [clearSession]);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await loginPatient(payload);
    const newSession: AuthenticatedPatientSession = {
      patientId: result.patient.id,
      patient: result.patient,
    };
    // Persist non-sensitive session metadata before state updates so the app
    // can restore the authenticated shell after a refresh. The credential
    // itself lives in an HttpOnly cookie.
    saveAuthSession(newSession);
    clearGuestSessionStorage();
    setSession(newSession);
    setPatient(result.patient);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const result = await registerPatient(payload);
    const newSession: AuthenticatedPatientSession = {
      patientId: result.patient.id,
      patient: result.patient,
    };
    saveAuthSession(newSession);
    clearGuestSessionStorage();
    setSession(newSession);
    setPatient(result.patient);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    clearSession();
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await getMe();
      if (isGuestPlaceholderProfile(profile)) {
        clearSession();
        return;
      }
      setPatient(profile);
      setSession(prev => prev ? { ...prev, patient: profile } : null);
    } catch {
      // ignore
    }
  }, [clearSession]);

  const updatePatient = useCallback((profile: PatientProfile) => {
    setPatient(profile);
    setSession(prev => prev ? { ...prev, patient: profile } : null);
  }, []);

  const upgradeFromGuest = useCallback(async (payload: UpgradeGuestPayload) => {
    const result = await upgradeGuestAccount(payload);
    const newSession: AuthenticatedPatientSession = {
      patientId: result.patient.id,
      patient: result.patient,
    };
    saveAuthSession(newSession);
    clearGuestSessionStorage();
    setSession(newSession);
    setPatient(result.patient);
  }, []);

  return (
    <AuthContext.Provider value={{ session, patient, loading, login, register, upgradeFromGuest, logout, clearSession, refreshProfile, updatePatient }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
