// HospitalApp/src/app/HospitalApp.tsx
// Main app component with navigation

import { useState } from 'react';
import { LoginPage } from '../auth/Login/LoginPage';
import { AdmitView } from '../features/admit/AdmitView';

export function HospitalApp() {
  const [currentView, setCurrentView] = useState<'login' | 'dashboard'>('dashboard');

  if (currentView === 'login') {
    return <LoginPage onLogin={() => setCurrentView('dashboard')} />;
  }

  return <AdmitView onBack={() => setCurrentView('login')} />;
}
