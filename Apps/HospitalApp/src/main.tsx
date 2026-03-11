import React from 'react';
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AuthProvider } from './auth/AuthContext';
import { DemoGatePage } from './auth/DemoGatePage';
import { useDemoGate } from './auth/useDemoGate';
import { ToastProvider } from './shared/ui/ToastContext';
import { HospitalApp } from './app/HospitalApp';

function DemoGateWrapper({ children }: { children: ReactNode }) {
  const { checking, gateActive, error, verify } = useDemoGate();

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '1.1rem' }}>
        Loading\u2026
      </div>
    );
  }

  if (gateActive) {
    return <DemoGatePage onVerify={verify} error={error} />;
  }

  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DemoGateWrapper>
      <AuthProvider>
        <ToastProvider>
          <HospitalApp />
        </ToastProvider>
      </AuthProvider>
    </DemoGateWrapper>
  </React.StrictMode>
);
