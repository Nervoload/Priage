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
import { listEncounters, startExam, confirmEncounter, dischargeEncounter } from '../shared/api/encounters';
import { ApiError } from '../shared/api/client';
import { connectSocket, disconnectSocket, getSocket, sendMessageViaSocket } from '../shared/realtime/socket';
import { listMessages } from '../shared/api/messaging';
import type { View } from '../shared/ui/NavBar';
import { getHospitalConfig } from '../shared/api/hospitals';
import { getPreferredLandingPage } from '../shared/settings/preferences';

// Re-export domain types so existing component imports keep working
export type { PatientSummary as Patient, ChatMessage, Encounter } from '../shared/types/domain';
export { patientName } from '../shared/types/domain';

import type {
  ChatMessage,
  EncounterListItem,
  EncounterStatus,
  HospitalConfigEnvelope,
  HospitalOperationalConfig,
  Message,
} from '../shared/types/domain';
import { RealtimeEvents, messageToChatMessage } from '../shared/types/domain';

// View type imported from NavBar

const DEFAULT_HOSPITAL_CONFIG: HospitalOperationalConfig = {
  version: 1,
  pageAccess: {
    ADMIN: ['admit', 'triage', 'waiting', 'analytics', 'settings'],
    NURSE: ['triage', 'waiting', 'analytics', 'settings'],
    STAFF: ['admit', 'waiting', 'settings'],
    DOCTOR: ['triage', 'waiting', 'analytics', 'settings'],
  },
  customIntakeQuestions: [],
  admittanceFeedbackSurvey: [],
};

function getLastChatMessageId(messages: ChatMessage[]): number | null {
  if (messages.length === 0) {
    return null;
  }

  const lastMessageId = Number(messages[messages.length - 1].id);
  return Number.isFinite(lastMessageId) ? lastMessageId : null;
}

function appendUniqueChatMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) {
    return existing;
  }

  const seen = new Set(existing.map((message) => message.id));
  const next = [...existing];

  for (const message of incoming) {
    if (seen.has(message.id)) {
      continue;
    }
    seen.add(message.id);
    next.push(message);
  }

  return next;
}

export function HospitalApp() {
  const { user, initializing, logout } = useAuth();
  const { showToast } = useToast();
  const [currentView, setCurrentView] = useState<View>('admit');
  const [hospitalConfig, setHospitalConfig] = useState<HospitalOperationalConfig | null>(null);
  const [configUpdatedAt, setConfigUpdatedAt] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [encounters, setEncounters] = useState<EncounterListItem[]>([]);
  const [chatMessages, setChatMessages] = useState<Record<number, ChatMessage[]>>({});
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const [waitingRoomRealtimeEnabled, setWaitingRoomRealtimeEnabled] = useState(false);
  const isMounted = useRef(true);
  const activeUserId = useRef<number | null>(null);
  const loadedMessageEncounters = useRef<Set<number>>(new Set());
  const messageCursorByEncounter = useRef<Map<number, number | null>>(new Map());
  const loadingMessageEncounters = useRef<Set<number>>(new Set());
  const messageRetryAt = useRef<Map<number, number>>(new Map());
  const effectiveConfig = hospitalConfig ?? DEFAULT_HOSPITAL_CONFIG;
  const availableViews = useMemo<View[]>(
    () => (user ? effectiveConfig.pageAccess[user.role] : []),
    [effectiveConfig, user],
  );

  const visibleEncounterStatuses = useMemo<EncounterStatus[]>(() => {
    const statuses = new Set<EncounterStatus>();

    if (availableViews.includes('admit')) {
      statuses.add('EXPECTED');
      statuses.add('ADMITTED');
    }
    if (availableViews.includes('triage')) {
      statuses.add('TRIAGE');
    }
    if (availableViews.includes('waiting')) {
      statuses.add('WAITING');
      statuses.add('COMPLETE');
    }

    return Array.from(statuses);
  }, [availableViews]);

  // ─── Load hospital configuration ────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setHospitalConfig(null);
      setConfigUpdatedAt(null);
      setLoadingConfig(false);
      return;
    }

    let cancelled = false;
    setLoadingConfig(true);

    void getHospitalConfig(user.hospitalId)
      .then((response) => {
        if (cancelled) return;
        setHospitalConfig(response.config);
        setConfigUpdatedAt(response.updatedAt);
      })
      .catch((error) => {
        console.error('[HospitalApp] Failed to load hospital config:', error);
        if (cancelled) return;
        setHospitalConfig(DEFAULT_HOSPITAL_CONFIG);
        setConfigUpdatedAt(null);
        showToast('Loaded fallback hospital settings. Admin configuration could not be refreshed.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, showToast]);

  useEffect(() => {
    if (!user || availableViews.length === 0) return;

    const preferredView = getPreferredLandingPage(user.userId, availableViews) ?? availableViews[0];
    if (activeUserId.current !== user.userId) {
      activeUserId.current = user.userId;
      setCurrentView(preferredView);
      return;
    }

    setCurrentView((existing) => (availableViews.includes(existing) ? existing : preferredView));
  }, [availableViews, user]);

  useEffect(() => {
    if (!user) {
      setWaitingRoomRealtimeEnabled(false);
      setChatMessages({});
      loadedMessageEncounters.current.clear();
      messageCursorByEncounter.current.clear();
      loadingMessageEncounters.current.clear();
      messageRetryAt.current.clear();
      disconnectSocket();
    }
  }, [user]);

  // ─── Fetch encounters from backend ──────────────────────────────────────

  const fetchEncounters = useCallback(async () => {
    if (!user || loadingConfig) return;
    try {
      setLoadingEncounters(true);
      const visibleRes = visibleEncounterStatuses.length > 0
        ? await listEncounters({ status: visibleEncounterStatuses })
        : { data: [], total: 0 };
      if (isMounted.current) {
        setEncounters(visibleRes.data);
      }
    } catch (err) {
      console.error('[HospitalApp] Failed to fetch encounters:', err);
      if (err instanceof ApiError && err.status === 401) return; // handled by auth-expired
      showToast('Failed to load encounters. Please try again.', 'error');
    } finally {
      if (isMounted.current) setLoadingEncounters(false);
    }
  }, [availableViews, loadingConfig, showToast, user, visibleEncounterStatuses]);

  const upsertChatMessage = useCallback((message: Message) => {
    const nextMessage = messageToChatMessage(message);
    setChatMessages((prev) => {
      const existing = prev[nextMessage.encounterId] || [];
      if (existing.some((item) => item.id === nextMessage.id)) {
        messageCursorByEncounter.current.set(
          nextMessage.encounterId,
          getLastChatMessageId(existing),
        );
        loadedMessageEncounters.current.add(nextMessage.encounterId);
        return prev;
      }

      const merged = appendUniqueChatMessages(existing, [nextMessage]);
      messageCursorByEncounter.current.set(nextMessage.encounterId, getLastChatMessageId(merged));
      loadedMessageEncounters.current.add(nextMessage.encounterId);
      return {
        ...prev,
        [nextMessage.encounterId]: merged,
      };
    });
  }, []);

  const loadMessagesForEncounter = useCallback(async (encounterId: number, mode: 'replace' | 'append' = 'replace') => {
    const now = Date.now();
    const retryAt = messageRetryAt.current.get(encounterId) ?? 0;
    if (loadingMessageEncounters.current.has(encounterId) || now < retryAt) {
      return;
    }

    loadingMessageEncounters.current.add(encounterId);
    try {
      const currentCursor = messageCursorByEncounter.current.get(encounterId) ?? null;
      if (mode === 'append' && currentCursor == null) {
        return;
      }

      const shouldAppend = mode === 'append';
      const res = await listMessages(encounterId, {
        limit: 100,
        ...(shouldAppend && currentCursor != null ? { afterMessageId: currentCursor } : {}),
      });
      const nextMessages = res.data.map(messageToChatMessage);
      loadedMessageEncounters.current.add(encounterId);
      messageRetryAt.current.delete(encounterId);
      setChatMessages((prev) => {
        if (shouldAppend) {
          if (nextMessages.length === 0) {
            return prev;
          }

          const existing = prev[encounterId] || [];
          const merged = appendUniqueChatMessages(existing, nextMessages);
          messageCursorByEncounter.current.set(encounterId, getLastChatMessageId(merged));
          if (merged.length === existing.length) {
            return prev;
          }
          return {
            ...prev,
            [encounterId]: merged,
          };
        }

        messageCursorByEncounter.current.set(encounterId, getLastChatMessageId(nextMessages));
        return {
          ...prev,
          [encounterId]: nextMessages,
        };
      });
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

  // Fetch on login and only subscribe to staff-wide waiting-room realtime
  // after the user explicitly joins that workspace.
  useEffect(() => {
    if (!user || loadingConfig) return;
    isMounted.current = true;

    fetchEncounters();

    if (!waitingRoomRealtimeEnabled) {
      disconnectSocket();
      return () => {
        isMounted.current = false;
      };
    }

    const socket = getSocket();
    const handleConnect = () => {
      void fetchEncounters();
      for (const encounterId of loadedMessageEncounters.current) {
        void loadMessagesForEncounter(encounterId, 'append');
      }
    };
    const handleEncounterUpdate = () => {
      void fetchEncounters();
    };
    const handleMessageCreated = (payload: { encounterId: number }) => {
      void loadMessagesForEncounter(payload.encounterId, 'append');
    };

    socket.on('connect', handleConnect);
    socket.on(RealtimeEvents.EncounterUpdated, handleEncounterUpdate);
    socket.on(RealtimeEvents.MessageCreated, handleMessageCreated);
    connectSocket();

    return () => {
      isMounted.current = false;
      socket.off('connect', handleConnect);
      socket.off(RealtimeEvents.EncounterUpdated, handleEncounterUpdate);
      socket.off(RealtimeEvents.MessageCreated, handleMessageCreated);
    };
  }, [user, loadingConfig, fetchEncounters, loadMessagesForEncounter, waitingRoomRealtimeEnabled]);

  const handleSendMessage = useCallback(async (encounterId: number, text: string) => {
    if (!waitingRoomRealtimeEnabled) {
      showToast('Enter the Waiting Room to start live messaging.', 'info');
      throw new Error('Waiting room realtime is not active');
    }

    try {
      const created = await sendMessageViaSocket(encounterId, text);
      upsertChatMessage(created);
    } catch (err) {
      console.error('[HospitalApp] Failed to send message:', err);
      showToast('Failed to send message. Please try again.', 'error');
      throw err;
    }
  }, [showToast, upsertChatMessage, waitingRoomRealtimeEnabled]);

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

  // Waiting room shows patients that completed triage and are waiting or seen
  const waitingEncounters = useMemo(
    () => encounters.filter((e) => e.status === 'WAITING' || e.status === 'COMPLETE'),
    [encounters],
  );

  useEffect(() => {
    if (!waitingRoomRealtimeEnabled || currentView !== 'waiting' || !availableViews.includes('waiting')) return;
    for (const encounter of waitingEncounters) {
      if (!loadedMessageEncounters.current.has(encounter.id)) {
        void loadMessagesForEncounter(encounter.id, 'replace');
      }
    }
  }, [availableViews, currentView, loadMessagesForEncounter, waitingEncounters, waitingRoomRealtimeEnabled]);

  // ─── Show loading spinner while checking stored token ───────────────────

  if (initializing || (user && loadingConfig)) {
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
    if (!availableViews.includes(view)) return;
    setCurrentView(view);
  };

  const handleBack = () => {
    logout();
  };

  // Smart admit: pick the right status transition based on current state.
  //   EXPECTED  → confirm  → ADMITTED
  //   ADMITTED  → startExam → TRIAGE
  //   WAITING   → startExam → TRIAGE
  const handleAdmit = async (encounter: EncounterListItem) => {
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

  const handleRemovePatient = async (encounterId: number) => {
    try {
      await dischargeEncounter(encounterId);
      showToast('Patient removed from waiting room', 'success');
      await fetchEncounters();
    } catch (err) {
      console.error('[HospitalApp] Failed to remove patient:', err);
      if (err instanceof ApiError && err.status === 401) return;
      showToast('Failed to remove patient. Please try again.', 'error');
      throw err;
    }
  };

  const userInfo = user ? { email: user.email, role: user.role } : null;
  const handleConfigUpdated = (response: HospitalConfigEnvelope) => {
    setHospitalConfig(response.config);
    setConfigUpdatedAt(response.updatedAt);
  };

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
          availableViews={availableViews}
          customFormQuestions={effectiveConfig.customIntakeQuestions}
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
          availableViews={availableViews}
        />
      )}
      {currentView === 'waiting' && (
        <WaitingRoomView
          onBack={handleBack}
          onNavigate={handleNavigate}
          encounters={waitingEncounters}
          chatMessages={chatMessages}
          onSendMessage={handleSendMessage}
          onRemovePatient={handleRemovePatient}
          loading={loadingEncounters}
          onRefresh={fetchEncounters}
          user={userInfo}
          availableViews={availableViews}
          realtimeActive={waitingRoomRealtimeEnabled}
          onEnterWaitingRoom={() => setWaitingRoomRealtimeEnabled(true)}
        />
      )}
      {currentView === 'analytics' && (
        <AnalyticsPage
          onNavigate={handleNavigate}
          onLogout={handleBack}
          user={userInfo}
          hospitalId={user.hospitalId}
          availableViews={availableViews}
        />
      )}
      {currentView === 'settings' && (
        <SettingsPage
          onNavigate={handleNavigate}
          onLogout={handleBack}
          user={user}
          availableViews={availableViews}
          configEnvelope={{
            hospitalId: user.hospitalId,
            updatedAt: configUpdatedAt,
            config: effectiveConfig,
          }}
          onConfigUpdated={handleConfigUpdated}
        />
      )}
    </>
  );
}
