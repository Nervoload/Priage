import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './shared/hooks/useAuth';
import { ToastProvider } from './shared/ui/ToastContext';
import { PatientApp } from './app/PatientApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <PatientApp />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
