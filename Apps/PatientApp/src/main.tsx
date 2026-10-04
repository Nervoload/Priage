import React from 'react';
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './index.css';
import { DemoGatePage } from './auth/DemoGatePage';
import { useDemoGate } from './auth/useDemoGate';
import { AuthProvider } from './shared/hooks/useAuth';
import { GuestSessionProvider } from './shared/hooks/useGuestSession';
import { ToastProvider } from './shared/ui/ToastContext';
import { LoadingScreen } from './shared/ui/Controls';
import { PatientApp } from './app/PatientApp';

function DemoGateWrapper({ children }: { children: ReactNode }) {
  const { checking, gateActive, error, verify } = useDemoGate();

  if (checking) {
    return <LoadingScreen full />;
  }

  if (gateActive) {
    return <DemoGatePage onVerify={verify} error={error} />;
  }

  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DemoGateWrapper>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
