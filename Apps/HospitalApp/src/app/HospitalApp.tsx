// HospitalApp/src/app/HospitalApp.tsx
// Main app component with simple routing

import { useState } from 'react';
import { LoginPage } from '../auth/Login/LoginPage';
import { AdmitView } from '../features/admit/AdmitView';
import { TriageView } from '../features/triage/TriageView';
import { WaitingRoomView } from '../features/waitingroom/WaitingRoomView';

type View = 'admit' | 'triage' | 'waiting';

export function HospitalApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<View>('admit');

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  const handleNavigate = (view: View) => {
    setCurrentView(view);
  };

  const handleBack = () => {
    setIsLoggedIn(false);
  };

  return (
    <>
      {currentView === 'admit' && (
        <AdmitView onBack={handleBack} onNavigate={handleNavigate} />
      )}
      {currentView === 'triage' && (
        <TriageView onBack={handleBack} onNavigate={handleNavigate} />
      )}
      {currentView === 'waiting' && (
        <WaitingRoomView onBack={handleBack} onNavigate={handleNavigate} />
      )}
    </>
  );
}
