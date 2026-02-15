// HospitalApp/src/app/HospitalApp.tsx
// Main app component with simple routing

import { useState } from 'react';
import { LoginPage } from '../auth/Login/LoginPage';
import { AdmitView } from '../features/admit/AdmitView';
import { TriageView } from '../features/triage/TriageView';
import { WaitingRoomView } from '../features/waitingroom/WaitingRoomView';

type View = 'admit' | 'triage' | 'waiting';

// Shared encounter type
export interface Patient {
  id: number;
  displayName: string;
  phone: string | null;
}

export interface Encounter {
  id: number;
  createdAt: string;
  updatedAt: string;
  status: 'PRE_TRIAGE' | 'ARRIVED' | 'TRIAGE' | 'WAITING' | 'COMPLETE' | 'CANCELLED';
  hospitalName: string;
  chiefComplaint: string;
  details: string | null;
  patient: Patient;
}

export interface ChatMessage {
  id: string;
  encounterId: number;
  sender: 'admin' | 'patient';
  text: string;
  timestamp: string;
}

// Initial mock data (lives here so both views share it)
const initialEncounters: Encounter[] = [
  {
    id: 1,
    createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'PRE_TRIAGE',
    hospitalName: 'General Hospital',
    chiefComplaint: 'Severe abdominal pain',
    details: null,
    patient: { id: 1, displayName: 'Sarah Johnson', phone: '555-0101' },
  },
  {
    id: 2,
    createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ARRIVED',
    hospitalName: 'General Hospital',
    chiefComplaint: 'Chest pain and shortness of breath',
    details: null,
    patient: { id: 2, displayName: 'Michael Chen', phone: '555-0102' },
  },
  {
    id: 3,
    createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'PRE_TRIAGE',
    hospitalName: 'General Hospital',
    chiefComplaint: 'Severe headache and dizziness',
    details: null,
    patient: { id: 3, displayName: 'Emily Rodriguez', phone: '555-0103' },
  },
];

export function HospitalApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<View>('admit');
  const [encounters, setEncounters] = useState<Encounter[]>(initialEncounters);
  const [chatMessages, setChatMessages] = useState<Record<number, ChatMessage[]>>({});

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  const handleNavigate = (view: View) => {
    setCurrentView(view);
  };

  const handleBack = () => {
    setIsLoggedIn(false);
  };

  // Move a patient to triage (change status to TRIAGE)
  const handleAdmit = (encounter: Encounter) => {
    setEncounters(prev =>
      prev.map(e =>
        e.id === encounter.id
          ? { ...e, status: 'TRIAGE' as const, updatedAt: new Date().toISOString() }
          : e
      )
    );
  };

  // Send a chat message from admin to a patient (local state only)
  // TODO: Replace with WebSocket emit / REST POST when backend is connected
  const handleSendMessage = (encounterId: number, text: string) => {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      encounterId,
      sender: 'admin',
      text,
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => ({
      ...prev,
      [encounterId]: [...(prev[encounterId] || []), message],
    }));
  };

  // Admittance shows PRE_TRIAGE and ARRIVED patients
  const admitEncounters = encounters.filter(
    e => e.status === 'PRE_TRIAGE' || e.status === 'ARRIVED'
  );

  // Triage shows TRIAGE patients
  const triageEncounters = encounters.filter(e => e.status === 'TRIAGE');

  // Waiting room shows all patients that have been admitted (TRIAGE, WAITING, COMPLETE)
  const waitingEncounters = encounters.filter(
    e => e.status === 'TRIAGE' || e.status === 'WAITING' || e.status === 'COMPLETE'
  );

  return (
    <>
      {currentView === 'admit' && (
        <AdmitView
          onBack={handleBack}
          onNavigate={handleNavigate}
          encounters={admitEncounters}
          onAdmit={handleAdmit}
        />
      )}
      {currentView === 'triage' && (
        <TriageView
          onBack={handleBack}
          onNavigate={handleNavigate}
          encounters={triageEncounters}
        />
      )}
      {currentView === 'waiting' && (
        <WaitingRoomView
          onBack={handleBack}
          onNavigate={handleNavigate}
          encounters={waitingEncounters}
          chatMessages={chatMessages}
          onSendMessage={handleSendMessage}
        />
      )}
    </>
  );
}
