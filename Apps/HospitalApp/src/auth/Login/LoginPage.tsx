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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login(email, password);
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,247,237,0.95)_0%,_rgba(248,250,252,1)_34%,_rgba(241,245,249,1)_100%)] p-8 font-hospital-body">
      {/* Branding */}
      <div className="mb-10 text-center animate-fade-in-up">
        <h1 className="font-hospital-display text-5xl font-semibold tracking-[-0.04em] text-priage-600">Priage</h1>
        <p className="mt-1 text-sm text-slate-500">Emergency Room Information &amp; Monitoring Pipeline</p>
      </div>

      {/* Card */}
      <div className="animate-fade-in-up w-full max-w-[420px] rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-[0_32px_90px_-56px_rgba(15,23,42,0.5)] backdrop-blur-sm">
        {/* Avatar */}
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-priage-600 shadow-[0_18px_38px_-24px_rgba(30,58,95,0.82)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="7" r="4"/>
              <path d="M5 21c0-3.5 3-5 7-5s7 1.5 7 5"/>
            </svg>
          </div>
        </div>

        <h2 className="text-center font-hospital-display text-xl font-semibold tracking-[-0.02em] text-slate-900">Hospital App</h2>
        <p className="mb-6 mt-1 text-center text-xs font-medium text-slate-500">Manage patients, triage, and monitor the ER pipeline</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.55)] transition-all placeholder:text-slate-400 focus:border-priage-300 focus:outline-none focus:ring-2 focus:ring-priage-200"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.55)] transition-all placeholder:text-slate-400 focus:border-priage-300 focus:outline-none focus:ring-2 focus:ring-priage-200"
            />
          </div>

          <button
            type="submit"
            disabled={loggingIn}
            className="w-full rounded-xl bg-accent-600 py-2.5 text-sm font-semibold text-white shadow-[0_18px_40px_-26px_rgba(220,38,38,0.72)] transition-all duration-200 hover:bg-accent-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingIn ? 'Signing In…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
