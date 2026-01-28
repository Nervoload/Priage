// HospitalApp/src/auth/Login/LoginPage.tsx
// Login page matching the Priage landing page design

import { useState } from 'react';

interface LoginPageProps {
  onLogin?: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement login logic
    console.log('Login:', { email, password });
    onLogin?.();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0f2fe 0%, #e9d5ff 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      {/* Title Section */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{
          fontSize: '4rem',
          fontWeight: 'bold',
          color: '#2563eb',
          margin: 0,
          marginBottom: '0.5rem',
        }}>
          Priage
        </h1>
        <p style={{
          fontSize: '1.125rem',
          color: '#6b7280',
          margin: 0,
        }}>
          Emergency Room Information & Monitoring Pipeline
        </p>
      </div>

      {/* Login Card */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '2.5rem',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="7" r="4" />
              <path d="M5 21c0-3.5 3-5 7-5s7 1.5 7 5" />
            </svg>
          </div>
        </div>

        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: '#1f2937',
          textAlign: 'center',
          marginBottom: '0.5rem',
        }}>
          Hospital App
        </h2>

        <p style={{
          fontSize: '0.875rem',
          color: '#9ca3af',
          textAlign: 'center',
          marginBottom: '2rem',
        }}>
          Manage patients, triage, and monitor the ER pipeline
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem',
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#7c3aed';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
              }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#7c3aed';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#6d28d9';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#7c3aed';
            }}
          >
            Sign In
          </button>
        </form>
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed',
        bottom: '1rem',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 2rem',
      }}>
        <div style={{
          backgroundColor: '#1f2937',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
        }}>
          Do not sell or share my personal info
        </div>
        <button
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#1f2937',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
          onClick={() => alert('Help')}
        >
          ?
        </button>
      </div>
    </div>
  );
}
