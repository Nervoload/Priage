// HospitalApp/src/shared/api/auth.ts
// API calls for authentication — mirrors backend AuthController.

import { client } from './client';
import type { LoginResponse, AuthUser } from '../types/domain';

/**
 * POST /auth/login
 * Returns JWT + user info. Stores token in localStorage.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const result = await client<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem('authToken', result.access_token);
  return result;
}

/**
 * GET /auth/me
 * Returns the currently authenticated user's info from the JWT.
 */
export async function getMe(): Promise<AuthUser> {
  return client<AuthUser>('/auth/me');
}

/**
 * Clear local auth state.
 */
export function logout(): void {
  localStorage.removeItem('authToken');
}

/**
 * Check if there's a stored auth token.
 */
export function hasToken(): boolean {
  return !!localStorage.getItem('authToken');
}
