import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './shared/hooks/useAuth';
import { GuestSessionProvider } from './shared/hooks/useGuestSession';
import { ToastProvider } from './shared/ui/ToastContext';
import { PatientApp } from './app/PatientApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <GuestSessionProvider>
            <PatientApp />
          </GuestSessionProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
