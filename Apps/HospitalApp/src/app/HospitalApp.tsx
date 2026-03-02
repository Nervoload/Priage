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
import { getSocket, sendMessageViaSocket } from '../shared/realtime/socket';
import { useAlerts } from '../shared/api/useAlerts';
import { AlertsBanner } from '../features/alerts/AlertsBanner';
import { listMessages } from '../shared/api/messaging';

// Re-export domain types so existing component imports keep working
export type { PatientSummary as Patient, ChatMessage, Encounter } from '../shared/types/domain';
export { patientName } from '../shared/types/domain';

import type { Encounter, ChatMessage, EncounterStatus, Message } from '../shared/types/domain';
import { RealtimeEvents, messageToChatMessage } from '../shared/types/domain';

type View = 'admit' | 'triage' | 'waiting';

export function HospitalApp() {
  const { user, initializing, logout } = useAuth();
  const { showToast } = useToast();
  const [currentView, setCurrentView] = useState<View>('admit');
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [chatMessages, setChatMessages] = useState<Record<number, ChatMessage[]>>({});
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const isMounted = useRef(true);
  const loadedMessageEncounters = useRef<Set<number>>(new Set());

  // ─── Alerts (derived + server) ────────────────────────────────────────────

  const { alerts, unacknowledgedCount, acknowledge, severityColors } = useAlerts(
    encounters,
    user?.hospitalId ?? null,
  );

  // ─── Fetch encounters from backend ──────────────────────────────────────

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

  const upsertChatMessage = useCallback((message: Message) => {
    const nextMessage = messageToChatMessage(message);
    setChatMessages((prev) => {
      const existing = prev[nextMessage.encounterId] || [];
      if (existing.some((item) => item.id === nextMessage.id)) {
        return prev;
      }
      return {
        ...prev,
        [nextMessage.encounterId]: [...existing, nextMessage],
      };
    });
  }, []);

  const fetchMessagesForEncounter = useCallback(async (encounterId: number) => {
    try {
      const res = await listMessages(encounterId, { limit: 200 });
      loadedMessageEncounters.current.add(encounterId);
      setChatMessages((prev) => ({
        ...prev,
        [encounterId]: res.data.map(messageToChatMessage),
      }));
    } catch (err) {
      console.error(`[HospitalApp] Failed to fetch messages for encounter ${encounterId}:`, err);
      if (err instanceof ApiError && err.status === 401) return;
      showToast('Failed to load messages. Please try again.', 'error');
    }
  }, [showToast]);

  // Fetch on login and listen for real-time updates
  useEffect(() => {
    if (!user) return;
    isMounted.current = true;

    fetchEncounters();

    const socket = getSocket();
    const handleConnect = () => {
      void fetchEncounters();
      for (const encounterId of loadedMessageEncounters.current) {
        void fetchMessagesForEncounter(encounterId);
      }
    };
    const handleEncounterUpdate = () => {
      void fetchEncounters();
    };
    const handleMessageCreated = (payload: { encounterId: number }) => {
      void fetchMessagesForEncounter(payload.encounterId);
    };

    socket.on('connect', handleConnect);
    socket.on(RealtimeEvents.EncounterUpdated, handleEncounterUpdate);
    socket.on(RealtimeEvents.MessageCreated, handleMessageCreated);

    return () => {
      isMounted.current = false;
      socket.off('connect', handleConnect);
      socket.off(RealtimeEvents.EncounterUpdated, handleEncounterUpdate);
      socket.off(RealtimeEvents.MessageCreated, handleMessageCreated);
    };
  }, [user, fetchEncounters, fetchMessagesForEncounter]);

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

  const handleSendMessage = useCallback(async (encounterId: number, text: string) => {
    try {
      const created = await sendMessageViaSocket(encounterId, text);
      upsertChatMessage(created);
    } catch (err) {
      console.error('[HospitalApp] Failed to send message:', err);
      showToast('Failed to send message. Please try again.', 'error');
      throw err;
    }
  }, [showToast, upsertChatMessage]);

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

  useEffect(() => {
    if (currentView !== 'waiting') return;
    for (const encounter of waitingEncounters) {
      if (!loadedMessageEncounters.current.has(encounter.id)) {
        void fetchMessagesForEncounter(encounter.id);
      }
    }
  }, [currentView, waitingEncounters, fetchMessagesForEncounter]);

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
