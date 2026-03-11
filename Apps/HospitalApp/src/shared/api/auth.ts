// HospitalApp/src/shared/api/auth.ts
// API calls for authentication — mirrors backend AuthController.

import { client } from './client';
import type { LoginResponse, AuthUser } from '../types/domain';

/**
 * POST /auth/login
 * Returns JWT + user info and relies on an HttpOnly auth cookie for browser auth.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  return client<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * GET /auth/me
 * Returns the currently authenticated user's info from the JWT.
 */
export async function getMe(): Promise<AuthUser> {
  return client<AuthUser>('/auth/me');
}

/**
 * Clear backend auth cookie.
 */
export async function logout(): Promise<void> {
  await client('/auth/logout', { method: 'POST' });
}
