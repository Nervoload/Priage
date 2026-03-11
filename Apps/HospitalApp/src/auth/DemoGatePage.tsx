import { useState } from 'react';

interface DemoGatePageProps {
  onVerify: (code: string) => Promise<void>;
  error: string | null;
}

export function DemoGatePage({ onVerify, error }: DemoGatePageProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onVerify(code.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-8">
      {/* Branding */}
      <div className="text-center mb-10 animate-fade-in-up">
        <h1 className="text-5xl font-bold text-priage-600 mb-1">Priage</h1>
        <p className="text-gray-500 text-sm">Emergency Room Information &amp; Monitoring Pipeline</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-[400px] animate-fade-in-up">
        {/* Lock icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-priage-600 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 text-center mb-0.5">Demo Access</h2>
        <p className="text-xs text-gray-400 text-center mb-6">Enter your access code to continue</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="demo-code" className="block text-sm font-medium text-gray-700 mb-1">Access Code</label>
            <input
              id="demo-code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              placeholder="Enter demo access code"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-priage-300 focus:border-priage-400 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !code.trim()}
            className="w-full py-2.5 bg-accent-600 text-white rounded-lg font-semibold text-sm hover:bg-accent-700 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Verifying…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
