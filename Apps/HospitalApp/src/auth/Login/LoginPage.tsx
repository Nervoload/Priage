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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login(email, password, mfaCode || undefined);
      onLogin?.();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password.');
      } else if (err instanceof ApiError) {
        setError(`Login failed (${err.status}). Please try again.`);
      } else {
        setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      }
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/60 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-priage-400/40 focus:border-priage-400 focus:bg-white transition-all';

  return (
    <div className="min-h-screen bg-[radial-gradient(1000px_circle_at_15%_-10%,_rgba(219,234,254,0.7)_0%,_transparent_55%),radial-gradient(900px_circle_at_90%_10%,_rgba(224,242,254,0.6)_0%,_transparent_50%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] flex flex-col items-center justify-center p-8 font-hospital-body">
      {/* Branding */}
      <div className="text-center mb-10 animate-fade-in-up">
        <h1 className="font-hospital-display text-5xl font-bold tracking-[-0.04em] text-priage-700 mb-2">Priage</h1>
        <p className="text-slate-500 text-sm">Emergency Room Information &amp; Monitoring Pipeline</p>
      </div>

      {/* Card */}
      <div className="bg-white/90 backdrop-blur-xl rounded-[24px] border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_32px_80px_-48px_rgba(15,23,42,0.45)] p-8 w-full max-w-[400px] animate-fade-in-up">
        {/* Avatar */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-priage-600 to-priage-800 shadow-[0_18px_40px_-18px_rgba(17,31,54,0.7)] ring-1 ring-white/40 flex items-center justify-center">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="7" r="4"/>
              <path d="M5 21c0-3.5 3-5 7-5s7 1.5 7 5"/>
            </svg>
          </div>
        </div>

        <h2 className="font-hospital-display text-xl font-semibold tracking-[-0.02em] text-slate-900 text-center mb-1">Hospital App</h2>
        <p className="text-xs text-slate-400 text-center mb-7">Manage patients, triage, and monitor the ER pipeline</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200/80 rounded-xl px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-[13px] font-semibold text-slate-700 mb-1.5">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="mfaCode" className="block text-[13px] font-semibold text-slate-700 mb-1.5">Authenticator code</label>
            <input
              id="mfaCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Required when MFA is enabled"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[13px] font-semibold text-slate-700 mb-1.5">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full py-3 bg-gradient-to-b from-accent-500 to-accent-600 text-white rounded-xl font-semibold text-sm shadow-[0_14px_30px_-14px_rgba(220,38,38,0.65)] hover:from-accent-600 hover:to-accent-700 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loggingIn ? 'Signing In…' : 'Sign In'}
          </button>
        </form>
      </div>

      <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
        Authorized staff only
      </p>
    </div>
  );
}
