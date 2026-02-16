// HospitalApp/src/auth/AuthContext.tsx
// Global auth context — stores JWT user info and provides login/logout.
// Wraps the app so any component can access the current user + hospitalId.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser, LoginResponse } from '../shared/types/domain';
import { login as apiLogin, getMe, logout as apiLogout, hasToken } from '../shared/api/auth';
import { connectSocket, disconnectSocket } from '../shared/realtime/socket';

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
  /** Log in with email + password. Throws on failure. */
  login: (email: string, password: string) => Promise<LoginResponse>;
  /** Log out and clear all auth state. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  // On mount: if there's a stored token, validate it via GET /auth/me
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasToken()) {
        setInitializing(false);
        return;
      }
      try {
        const me = await getMe();
        if (!cancelled) {
          setUser(me);
          connectSocket();
        }
      } catch {
        // Token expired or invalid — clear it silently
        apiLogout();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoggingIn(true);
    try {
      const result = await apiLogin(email, password);
      // Map the login response user shape → AuthUser shape
      setUser({
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
        hospitalId: result.user.hospitalId,
        hospital: result.user.hospital,
      });
      connectSocket();
      return result;
    } finally {
      setLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    disconnectSocket();
    apiLogout();
    setUser(null);
  }, []);

  // Listen for 401 responses from the API client and auto-logout
  useEffect(() => {
    const handleAuthExpired = () => {
      if (user) logout();
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, [user, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      hospitalId: user?.hospitalId ?? 0,
      initializing,
      loggingIn,
      login,
      logout,
    }),
    [user, initializing, loggingIn, login, logout],
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
