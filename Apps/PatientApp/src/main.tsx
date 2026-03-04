import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './shared/hooks/useAuth';
import { GuestSessionProvider } from './shared/hooks/useGuestSession';
import { ToastProvider } from './shared/ui/ToastContext';
import { PatientApp } from './app/PatientApp';
import { DemoProvider } from './shared/demo';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <DemoProvider>
            <GuestSessionProvider>
              <PatientApp />
            </GuestSessionProvider>
          </DemoProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
