// HospitalApp/src/shared/api/auth.ts
// API calls for authentication — mirrors backend AuthController.

import { client } from './client';
import type { LoginResponse, AuthUser } from '../types/domain';
import {
  getDemoStaffAuthUser,
  getDemoStaffLoginResponse,
  isStaticDemoMode,
  trackDemoEvent,
} from '../../../../DemoShared/src/staticDemo';

/**
 * POST /auth/login
 * Returns session metadata + user info and relies on an HttpOnly auth cookie for browser auth.
 */
export async function login(email: string, password: string, mfaCode?: string): Promise<LoginResponse> {
  if (isStaticDemoMode()) {
    trackDemoEvent('demo_staff_login', { email });
    return getDemoStaffLoginResponse() as LoginResponse;
  }
  return client<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, mfaCode: mfaCode || undefined }),
  });
}

/**
 * GET /auth/me
 * Returns the currently authenticated user's info from the active staff session.
 */
export async function getMe(options: { suppressAuthExpired?: boolean } = {}): Promise<AuthUser> {
  if (isStaticDemoMode()) {
    return getDemoStaffAuthUser() as AuthUser;
  }
  return client<AuthUser>('/auth/me', {
    suppressAuthExpired: options.suppressAuthExpired,
  });
}

/**
 * Clear backend auth cookie.
 */
export async function logout(): Promise<void> {
  if (isStaticDemoMode()) {
    trackDemoEvent('demo_staff_logout');
    return;
  }
  await client('/auth/logout', { method: 'POST' });
}
