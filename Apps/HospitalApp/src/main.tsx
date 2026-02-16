import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './shared/ui/ToastContext';
import { HospitalApp } from './app/HospitalApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <HospitalApp />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);
