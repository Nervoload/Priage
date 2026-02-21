// Patient login page.

import { useState } from 'react';
import { useAuth } from '../shared/hooks/useAuth';
import { useToast } from '../shared/ui/ToastContext';

interface LoginPageProps {
  onSwitchToSignup: () => void;
}

export function LoginPage({ onSwitchToSignup }: LoginPageProps) {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      showToast('Please enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <h1 style={styles.logo}>Priage</h1>
          <p style={styles.tagline}>Your AI-powered health companion</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <h2 style={styles.title}>Welcome back</h2>
          <p style={styles.subtitle}>Sign in to your account</p>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={styles.input}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.submitBtn,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={styles.switchContainer}>
          <span style={styles.switchText}>Don&apos;t have an account? </span>
          <button style={styles.switchBtn} onClick={onSwitchToSignup}>
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    padding: '1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: '#ffffff',
    borderRadius: '20px',
    padding: '2rem',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  logo: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#1e3a5f',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  tagline: {
    color: '#64748b',
    fontSize: '0.85rem',
    margin: '0.25rem 0 0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#64748b',
    margin: '-0.5rem 0 0.5rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    padding: '0.75rem 1rem',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  submitBtn: {
    padding: '0.85rem',
    background: '#1e3a5f',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '0.5rem',
    fontFamily: 'inherit',
  },
  switchContainer: {
    textAlign: 'center',
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid #f1f5f9',
  },
  switchText: {
    color: '#64748b',
    fontSize: '0.9rem',
  },
  switchBtn: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
