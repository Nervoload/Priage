// HospitalApp/src/app/HospitalApp.tsx
// Main app component with simple routing.
// Fetches real encounters from the backend API and listens for Socket.IO updates.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LoginPage } from '../auth/Login/LoginPage';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../shared/ui/ToastContext';
import { AdmitView } from '../features/admit/AdmitView';
import { TriageView } from '../features/triage/TriageView';
import { WaitingRoomView } from '../features/waitingroom/WaitingRoomView';
import { AnalyticsPage } from '../features/analytics/AnalyticsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { listEncounters, startExam, confirmEncounter } from '../shared/api/encounters';
import { ApiError } from '../shared/api/client';
import { getSocket, sendMessageViaSocket } from '../shared/realtime/socket';
import { listMessages } from '../shared/api/messaging';
import type { View } from '../shared/ui/NavBar';

// Re-export domain types so existing component imports keep working
export type { PatientSummary as Patient, ChatMessage, Encounter } from '../shared/types/domain';
export { patientName } from '../shared/types/domain';

import type { Encounter, ChatMessage, EncounterStatus, Message } from '../shared/types/domain';
import { RealtimeEvents, messageToChatMessage } from '../shared/types/domain';

// View type imported from NavBar

export function HospitalApp() {
  const { user, initializing, logout } = useAuth();
  const { showToast } = useToast();
  const [currentView, setCurrentView] = useState<View>('admit');
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [chatMessages, setChatMessages] = useState<Record<number, ChatMessage[]>>({});
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const isMounted = useRef(true);
  const loadedMessageEncounters = useRef<Set<number>>(new Set());
  const loadingMessageEncounters = useRef<Set<number>>(new Set());
  const messageRetryAt = useRef<Map<number, number>>(new Map());

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
    const now = Date.now();
    const retryAt = messageRetryAt.current.get(encounterId) ?? 0;
    if (loadingMessageEncounters.current.has(encounterId) || now < retryAt) {
      return;
    }

    loadingMessageEncounters.current.add(encounterId);
    try {
      const res = await listMessages(encounterId, { limit: 100 });
      loadedMessageEncounters.current.add(encounterId);
      messageRetryAt.current.delete(encounterId);
      setChatMessages((prev) => ({
        ...prev,
        [encounterId]: res.data.map(messageToChatMessage),
      }));
    } catch (err) {
      console.error(`[HospitalApp] Failed to fetch messages for encounter ${encounterId}:`, err);
      if (err instanceof ApiError && err.status === 401) return;
      if (err instanceof ApiError && err.status === 429) {
        messageRetryAt.current.set(encounterId, Date.now() + 10_000);
        return;
      }
      messageRetryAt.current.set(encounterId, Date.now() + 5_000);
      showToast('Failed to load messages. Please try again.', 'error');
    } finally {
      loadingMessageEncounters.current.delete(encounterId);
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
  const admitEncounters = useMemo(
    () => encounters.filter((e) => e.status === 'EXPECTED' || e.status === 'ADMITTED'),
    [encounters],
  );

  // Triage shows TRIAGE patients
  const triageEncounters = useMemo(
    () => encounters.filter((e) => e.status === 'TRIAGE'),
    [encounters],
  );

  // Waiting room shows all patients that have been admitted (TRIAGE, WAITING, COMPLETE)
  const waitingEncounters = useMemo(
    () => encounters.filter((e) => e.status === 'TRIAGE' || e.status === 'WAITING' || e.status === 'COMPLETE'),
    [encounters],
  );

  useEffect(() => {
    if (currentView !== 'waiting') return;
    for (const encounter of waitingEncounters) {
      if (!loadedMessageEncounters.current.has(encounter.id)) {
        void fetchMessagesForEncounter(encounter.id);
      }
    }
  }, [currentView, waitingEncounters, fetchMessagesForEncounter]);

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

  const userInfo = user ? { email: user.email, role: user.role } : null;

  return (
    <>
      {currentView === 'admit' && (
        <AdmitView
          onBack={handleBack}
          onNavigate={handleNavigate}
          encounters={admitEncounters}
          onAdmit={handleAdmit}
          loading={loadingEncounters}
          onRefresh={fetchEncounters}
          user={userInfo}
        />
      )}
      {currentView === 'triage' && (
        <TriageView
          onBack={handleBack}
          onNavigate={handleNavigate}
          encounters={triageEncounters}
          loading={loadingEncounters}
          onRefresh={fetchEncounters}
          user={userInfo}
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
          user={userInfo}
        />
      )}
      {currentView === 'analytics' && (
        <AnalyticsPage
          onNavigate={handleNavigate}
          onLogout={handleBack}
          user={userInfo}
        />
      )}
      {currentView === 'settings' && (
        <SettingsPage
          onNavigate={handleNavigate}
          onLogout={handleBack}
          user={userInfo}
        />
      )}
    </>
  );
}
