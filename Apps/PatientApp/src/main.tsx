import React from 'react';
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { DemoGatePage } from './auth/DemoGatePage';
import { useDemoGate } from './auth/useDemoGate';
import { AuthProvider } from './shared/hooks/useAuth';
import { GuestSessionProvider } from './shared/hooks/useGuestSession';
import { ToastProvider } from './shared/ui/ToastContext';
import { PatientApp } from './app/PatientApp';

function DemoGateWrapper({ children }: { children: ReactNode }) {
  const { checking, gateActive, error, verify } = useDemoGate();

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'sans-serif', color: '#4a5a77' }}>
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
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <GuestSessionProvider>
              <PatientApp />
            </GuestSessionProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </DemoGateWrapper>
  </React.StrictMode>,
);
