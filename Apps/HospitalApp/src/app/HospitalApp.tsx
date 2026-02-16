// HospitalApp/src/app/HospitalApp.tsx
// Main app component with simple routing.
// Fetches real encounters from the backend API and listens for Socket.IO updates.

import { useState, useEffect, useCallback, useRef } from 'react';
import { LoginPage } from '../auth/Login/LoginPage';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../shared/ui/ToastContext';
import { AdmitView } from '../features/admit/AdmitView';
import { TriageView } from '../features/triage/TriageView';
import { WaitingRoomView } from '../features/waitingroom/WaitingRoomView';
import { listEncounters, startExam, confirmEncounter } from '../shared/api/encounters';
import { ApiError } from '../shared/api/client';
import { getSocket } from '../shared/realtime/socket';
import { useAlerts } from '../shared/api/useAlerts';
import { AlertsBanner } from '../features/alerts/AlertsBanner';

// Re-export domain types so existing component imports keep working
export type { PatientSummary as Patient, ChatMessage, Encounter } from '../shared/types/domain';
export { patientName } from '../shared/types/domain';

import type { Encounter, ChatMessage, EncounterStatus } from '../shared/types/domain';
import { RealtimeEvents } from '../shared/types/domain';

type View = 'admit' | 'triage' | 'waiting';

export function HospitalApp() {
  const { user, initializing, logout } = useAuth();
  const { showToast } = useToast();
  const [currentView, setCurrentView] = useState<View>('admit');
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [chatMessages, setChatMessages] = useState<Record<number, ChatMessage[]>>({});
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const isMounted = useRef(true);

  // ─── Alerts (derived + server) ────────────────────────────────────────────

  const { alerts, unacknowledgedCount, acknowledge, severityColors } = useAlerts(
    encounters,
    user?.hospitalId ?? null,
  );

  // ─── Fetch encounters from backend ──────────────────────────────────────

  // Phase 6.3: Currently fetches all encounters without server-side filtering.
  // Once GET /patients supports query params (search, status, pagination),
  // add a search input to the UI and call a new searchPatients() API function.
  // The encounter list can remain as-is for the dashboard, but a dedicated
  // patient search modal/page would use the new filtered endpoint.
  const ACTIVE_STATUSES: EncounterStatus[] = ['EXPECTED', 'ADMITTED', 'TRIAGE', 'WAITING'];

  const fetchEncounters = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingEncounters(true);
      const res = await listEncounters({ status: ACTIVE_STATUSES });
      if (isMounted.current) {
        setEncounters(res.data);
      }
    } catch (err) {
      console.error('[HospitalApp] Failed to fetch encounters:', err);
      if (err instanceof ApiError && err.status === 401) return; // handled by auth-expired
      showToast('Failed to load encounters. Please try again.', 'error');
    } finally {
      if (isMounted.current) setLoadingEncounters(false);
    }
  }, [user, showToast]);

  // Fetch on login and listen for real-time updates
  useEffect(() => {
    if (!user) return;
    isMounted.current = true;

    fetchEncounters();

    const socket = getSocket();
    const handleEncounterUpdate = () => {
      fetchEncounters();
    };

    socket.on(RealtimeEvents.EncounterUpdated, handleEncounterUpdate);

    return () => {
      isMounted.current = false;
      socket.off(RealtimeEvents.EncounterUpdated, handleEncounterUpdate);
    };
  }, [user, fetchEncounters]);

  // ─── Show loading spinner while checking stored token ───────────────────

  if (initializing) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
        fontSize: '1.1rem',
      }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleNavigate = (view: View) => {
    setCurrentView(view);
  };

  const handleBack = () => {
    logout();
  };

  // Smart admit: pick the right status transition based on current state.
  //   EXPECTED  → confirm  → ADMITTED
  //   ADMITTED  → startExam → TRIAGE
  //   WAITING   → startExam → TRIAGE
  const handleAdmit = async (encounter: Encounter) => {
    try {
      if (encounter.status === 'EXPECTED') {
        await confirmEncounter(encounter.id);
        showToast(`${encounter.patient.firstName ?? 'Patient'} confirmed`, 'success');
      } else {
        await startExam(encounter.id);
        showToast(`Triage started for ${encounter.patient.firstName ?? 'patient'}`, 'success');
      }
      await fetchEncounters();
    } catch (err) {
      console.error('[HospitalApp] Failed to transition encounter:', err);
      if (err instanceof ApiError && err.status === 401) return;
      const action = encounter.status === 'EXPECTED' ? 'confirm' : 'start triage for';
      showToast(`Failed to ${action} patient. Please try again.`, 'error');
    }
  };

  // Send a chat message from admin to a patient (local state only)
  // TODO: Replace with POST /messaging/encounters/:id/messages when messaging API service is created
  // Phase 6.2: Replace this entire handler with a call to sendMessage() from
  // shared/api/messaging.ts (already built). Then subscribe to 'message.created'
  // Socket.IO events to update chatMessages state in real time. The messaging.ts
  // API client and the backend WebSocket gateway are both ready — this handler
  // just needs to be rewired.
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

  // Admittance shows EXPECTED and ADMITTED patients
  const admitEncounters = encounters.filter(
    e => e.status === 'EXPECTED' || e.status === 'ADMITTED'
  );

  // Triage shows TRIAGE patients
  const triageEncounters = encounters.filter(e => e.status === 'TRIAGE');

  // Waiting room shows all patients that have been admitted (TRIAGE, WAITING, COMPLETE)
  const waitingEncounters = encounters.filter(
    e => e.status === 'TRIAGE' || e.status === 'WAITING' || e.status === 'COMPLETE'
  );

  return (
    <>
      {/* ── User info pill (top-left) ─── */}
      {/* Phase 6.4: Make this pill clickable to open a profile page/modal where
          staff can edit their display name, avatar, department, and specialization.
          Replace the email initial circle with an avatar image once the profile
          module provides avatarUrl. Link to PATCH /users/me for saving changes. */}
      <div
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: 'white',
          padding: '0.4rem 0.85rem',
          borderRadius: '10px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.1)',
          fontSize: '0.8rem',
          color: '#374151',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#7c3aed',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.65rem',
            fontWeight: 700,
          }}
        >
          {user.email[0].toUpperCase()}
        </div>
        <span style={{ fontWeight: 500 }}>{user.email}</span>
        <span
          style={{
            padding: '0.1rem 0.4rem',
            borderRadius: '4px',
            backgroundColor: '#7c3aed20',
            color: '#7c3aed',
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {user.role}
        </span>
      </div>

      <AlertsBanner
        alerts={alerts}
        unacknowledgedCount={unacknowledgedCount}
        onAcknowledge={acknowledge}
        severityColors={severityColors}
      />
      {currentView === 'admit' && (
        <AdmitView
          onBack={handleBack}
          onNavigate={handleNavigate}
          encounters={admitEncounters}
          onAdmit={handleAdmit}
          loading={loadingEncounters}
          onRefresh={fetchEncounters}
        />
      )}
      {currentView === 'triage' && (
        <TriageView
          onBack={handleBack}
          onNavigate={handleNavigate}
          encounters={triageEncounters}
          loading={loadingEncounters}
          onRefresh={fetchEncounters}
        />
      )}
      {currentView === 'waiting' && (
        <WaitingRoomView
          onBack={handleBack}
          onNavigate={handleNavigate}
          encounters={waitingEncounters}
          chatMessages={chatMessages}
          onSendMessage={handleSendMessage}
          loading={loadingEncounters}
          onRefresh={fetchEncounters}
        />
      )}
    </>
  );
}
