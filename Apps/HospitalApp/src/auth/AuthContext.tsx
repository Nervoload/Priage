// HospitalApp/src/auth/AuthContext.tsx
// Global auth context — stores staff session user info and provides login/logout.
// Wraps the app so any component can access the current user + hospitalId.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser, LoginResponse } from '../shared/types/domain';
import { login as apiLogin, getMe, logout as apiLogout } from '../shared/api/auth';
import { ApiError, AUTH_EXPIRED_EVENT } from '../shared/api/client';
import { disconnectSocket } from '../shared/realtime/socket';

// ─── Context shape ──────────────────────────────────────────────────────────

interface AuthContextValue {
  /** The authenticated user, or null if not logged in. */
  user: AuthUser | null;
  /** Convenience — the user's hospital ID (0 if not logged in). */
  hospitalId: number;
  /** True while checking for an existing token on mount. */
  initializing: boolean;
  /** True while a login request is in flight. */
  loggingIn: boolean;
  /** Refresh the current user from the backend session. */
  refreshUser: () => Promise<AuthUser | null>;
  /** Log in with email + password. Throws on failure. */
  login: (email: string, password: string, mfaCode?: string) => Promise<LoginResponse>;
  /** Log out and clear all auth state. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  const logout = useCallback(() => {
    disconnectSocket();
    void apiLogout().catch(() => undefined);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        disconnectSocket();
        setUser(null);
        return null;
      }
      throw error;
    }
  }, []);

  // On mount: if there's a stored session cookie, validate it via GET /auth/me
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (!cancelled) {
          setUser(me);
        }
      } catch {
        // No active cookie-backed session.
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string, mfaCode?: string) => {
    setLoggingIn(true);
    try {
      const result = await apiLogin(email, password, mfaCode);
      // Map the login response user shape → AuthUser shape
      setUser({
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
        hospitalId: result.user.hospitalId,
        hospital: result.user.hospital,
      });
      return result;
    } finally {
      setLoggingIn(false);
    }
  }, []);

  // Listen for 401 responses from the API client and auto-logout
  useEffect(() => {
    const handleAuthExpired = () => {
      if (user) logout();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [user, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      hospitalId: user?.hospitalId ?? 0,
      initializing,
      loggingIn,
      refreshUser,
      login,
      logout,
    }),
    [user, initializing, loggingIn, refreshUser, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
