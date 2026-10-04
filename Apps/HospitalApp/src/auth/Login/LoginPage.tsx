// HospitalApp/src/auth/Login/LoginPage.tsx
// Login page — Tailwind-styled.

import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { ApiError } from '../../shared/api/client';

interface LoginPageProps {
  onLogin?: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const { login, loggingIn } = useAuth();
  const pilotMode = import.meta.env.VITE_CLINIC_PILOT_MODE === 'true';
  const pinnedClinicSlug = import.meta.env.VITE_HOSPITAL_SLUG?.trim().toLowerCase() || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hospitalSlug, setHospitalSlug] = useState(() => {
    const configuredClinic = pinnedClinicSlug;
    if (configuredClinic) return configuredClinic;
    try {
      return window.localStorage.getItem('priage:last-clinic') ?? '';
    } catch {
      return '';
    }
  });
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pilotMode && !pinnedClinicSlug) {
      setError('This clinic preview is missing its clinic configuration.');
      return;
    }

    try {
      const normalizedClinic = pilotMode ? pinnedClinicSlug : hospitalSlug.trim().toLowerCase();
      await login(email, password, normalizedClinic, mfaCode || undefined);
      try {
        window.localStorage.setItem('priage:last-clinic', normalizedClinic);
      } catch {
        // Storage can be unavailable in private or restricted browsing modes.
      }
      onLogin?.();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email, password, or clinic.');
      } else if (err instanceof ApiError) {
        setError(`Login failed (${err.status}). Please try again.`);
      } else {
        setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-8">
      {/* Branding */}
      <div className="text-center mb-10 animate-fade-in-up">
        <h1 className="text-5xl font-bold text-priage-600 mb-1">Priage</h1>
        <p className="text-gray-500 text-sm">Patient intake and care coordination</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-[400px] animate-fade-in-up">
        {/* Avatar */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-priage-600 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="7" r="4"/>
              <path d="M5 21c0-3.5 3-5 7-5s7 1.5 7 5"/>
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 text-center mb-0.5">Clinic App</h2>
        <p className="text-xs text-gray-400 text-center mb-6">Manage patient visits and care-team workflows</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          {pilotMode ? <p className="text-sm text-gray-600">Clinic: <strong>{pinnedClinicSlug || 'Not configured'}</strong></p> : <div>
            <label htmlFor="hospitalSlug" className="block text-sm font-medium text-gray-700 mb-1">Clinic</label>
            <input
              id="hospitalSlug"
              type="text"
              autoComplete="organization"
              value={hospitalSlug}
              onChange={(e) => setHospitalSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              required
              placeholder="clinic-slug"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-priage-300 focus:border-priage-400 transition-colors"
            />
          </div>}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-priage-300 focus:border-priage-400 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700 mb-1">Authenticator code</label>
            <input
              id="mfaCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Required when MFA is enabled"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-priage-300 focus:border-priage-400 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-priage-300 focus:border-priage-400 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loggingIn || (pilotMode && !pinnedClinicSlug)}
            className="w-full py-2.5 bg-accent-600 text-white rounded-lg font-semibold text-sm hover:bg-accent-700 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loggingIn ? 'Signing In…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
