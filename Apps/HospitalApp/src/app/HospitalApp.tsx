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
import { getEncounter, listEncounters, startExam, confirmEncounter, dischargeEncounter } from '../shared/api/encounters';
import { ApiError, getRetryAfterSeconds } from '../shared/api/client';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  subscribeToEncounterRealtime,
} from '../shared/realtime/socket';
import { listMessages, sendMessage } from '../shared/api/messaging';
import type { View } from '../shared/ui/NavBar';
import { getHospitalConfig } from '../shared/api/hospitals';
import { getPreferredLandingPage } from '../shared/settings/preferences';
import { ClinicReceptionBoard } from '../features/clinic/ClinicReceptionBoard';
import { CareView } from '../features/clinic/care/CareView';
import { ClinicAnalyticsView } from '../features/clinic/analytics/ClinicAnalyticsView';
import { ClinicShell, type ClinicView } from '../features/clinic/ui/ClinicShell';
import { ClinicToastProvider } from '../features/clinic/ui/toast';
import { EncounterBoardClock, mergeEncounterSnapshot } from './encounterBoardOrdering';

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
  version: 2,
  workflowProfile: 'ED',
  pageAccess: {
    ADMIN: ['admit', 'triage', 'waiting', 'analytics', 'settings'],
    IT_ADMIN: ['settings'],
    CLINICAL_ADMIN: ['admit', 'triage', 'waiting', 'analytics', 'settings'],
    NURSE: ['triage', 'waiting', 'analytics', 'settings'],
    STAFF: ['admit', 'settings'],
    DOCTOR: ['triage', 'waiting', 'analytics', 'settings'],
  },
  customIntakeQuestions: [],
  admittanceFeedbackSurvey: [],
};

// REST is only a safety net while the socket is unavailable. Keeping this
// interval slow avoids turning a transient WebSocket outage into an API spike.
const REALTIME_FALLBACK_REFRESH_MS = 30_000;
const MESSAGE_FALLBACK_BATCH_SIZE = 5;
const MAX_REMEMBERED_REALTIME_EVENTS = 1_000;

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

function buildEncounterSignature(encounters: EncounterListItem[]): string {
  return JSON.stringify(encounters);
}

function rememberRealtimeEvent(seen: Set<number>, eventId: number | undefined): boolean {
  if (typeof eventId !== 'number' || !Number.isInteger(eventId)) {
    return true;
  }
  if (seen.has(eventId)) {
    return false;
  }

  seen.add(eventId);
  if (seen.size > MAX_REMEMBERED_REALTIME_EVENTS) {
    const oldest = seen.values().next().value;
    if (oldest !== undefined) {
      seen.delete(oldest);
    }
  }
  return true;
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
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const isMounted = useRef(true);
  const activeUserId = useRef<number | null>(null);
  const loadedMessageEncounters = useRef<Set<number>>(new Set());
  const messageCursorByEncounter = useRef<Map<number, number | null>>(new Map());
  const loadingMessageEncounters = useRef<Set<number>>(new Set());
  const messageRetryAt = useRef<Map<number, number>>(new Map());
  const encounterRefreshTimer = useRef<number | null>(null);
  const encounterRateLimitToastAt = useRef(0);
  const encounterFetchInFlight = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const lastEncounterFetch = useRef<{ key: string; completedAt: number } | null>(null);
  const encounterDataSignature = useRef('');
  const encounterBoardClock = useRef(new EncounterBoardClock());
  const encountersRef = useRef<EncounterListItem[]>([]);
  const encounterOwnerUserId = useRef<number | null>(null);
  const encounterIdsRef = useRef<number[]>([]);
  const realtimeSubscriptionKey = useRef('');
  const seenRealtimeEventIds = useRef<Set<number>>(new Set());
  const effectiveConfig = hospitalConfig ?? DEFAULT_HOSPITAL_CONFIG;
  const availableViews = useMemo<View[]>(
    () => {
      if (!user) return [];
      if (effectiveConfig.workflowProfile === 'CLINIC_APPOINTMENT' || import.meta.env.VITE_CLINIC_PILOT_MODE === 'true') {
        if (user.role === 'IT_ADMIN') return ['admit', 'settings'];
        if (user.role === 'DOCTOR' || user.role === 'NURSE') return ['admit', 'care'];
        if (user.role === 'ADMIN' || user.role === 'CLINICAL_ADMIN') return ['admit', 'care', 'analytics', 'settings'];
        return ['admit'];
      }
      return effectiveConfig.pageAccess[user.role].filter((view) => view !== 'care');
    },
    [effectiveConfig, user],
  );
  const clinicalMessagingEnabled =
    user?.role === 'ADMIN' || user?.role === 'CLINICAL_ADMIN' || user?.role === 'NURSE' || user?.role === 'DOCTOR';

  const visibleEncounterStatuses = useMemo<EncounterStatus[]>(() => {
    if (effectiveConfig.workflowProfile === 'CLINIC_APPOINTMENT' || import.meta.env.VITE_CLINIC_PILOT_MODE === 'true') return [];
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
  }, [availableViews, effectiveConfig.workflowProfile]);
  const visibleEncounterStatusesKey = useMemo(
    () => visibleEncounterStatuses.join(','),
    [visibleEncounterStatuses],
  );

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
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setHospitalConfig(null);
          setConfigUpdatedAt(null);
          return;
        }
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
    if (!user || hospitalConfig === null || availableViews.length === 0) return;

    const preferredView = getPreferredLandingPage(user.userId, availableViews) ?? availableViews[0];
    if (activeUserId.current !== user.userId) {
      activeUserId.current = user.userId;
      setCurrentView(preferredView);
      return;
    }

    setCurrentView((existing) => (availableViews.includes(existing) ? existing : preferredView));
  }, [availableViews, hospitalConfig, user]);

  useEffect(() => {
    if (!user) {
      encounterOwnerUserId.current = null;
      encounterFetchInFlight.current = null;
      lastEncounterFetch.current = null;
      encounterDataSignature.current = '';
      encountersRef.current = [];
      setEncounters([]);
      setRealtimeConnected(false);
      setChatMessages({});
      loadedMessageEncounters.current.clear();
      messageCursorByEncounter.current.clear();
      loadingMessageEncounters.current.clear();
      messageRetryAt.current.clear();
      encounterIdsRef.current = [];
      realtimeSubscriptionKey.current = '';
      seenRealtimeEventIds.current.clear();
      if (encounterRefreshTimer.current !== null) {
        window.clearTimeout(encounterRefreshTimer.current);
        encounterRefreshTimer.current = null;
      }
      disconnectSocket();
      return;
    }

    if (encounterOwnerUserId.current !== user.userId) {
      disconnectSocket();
      setRealtimeConnected(false);
      encounterOwnerUserId.current = user.userId;
      encounterFetchInFlight.current = null;
      lastEncounterFetch.current = null;
      encounterDataSignature.current = '';
      encounterBoardClock.current.reset();
      encountersRef.current = [];
      setEncounters([]);
      setChatMessages({});
      loadedMessageEncounters.current.clear();
      messageCursorByEncounter.current.clear();
      loadingMessageEncounters.current.clear();
      messageRetryAt.current.clear();
      encounterIdsRef.current = [];
      realtimeSubscriptionKey.current = '';
      seenRealtimeEventIds.current.clear();
    }
  }, [user]);

  // ─── Fetch encounters from backend ──────────────────────────────────────

  const fetchEncounters = useCallback(async (options: { force?: boolean } = {}) => {
    if (!user || hospitalConfig === null || loadingConfig) return;

    const fetchKey = `${user.userId}:${visibleEncounterStatusesKey}`;
    if (encounterFetchInFlight.current?.key === fetchKey) {
      return encounterFetchInFlight.current.promise;
    }
    if (
      !options.force
      && lastEncounterFetch.current?.key === fetchKey
      && Date.now() - lastEncounterFetch.current.completedAt < 1_000
    ) {
      return;
    }

    const request = (async () => {
      const snapshotToken = encounterBoardClock.current.snapshotRequested();
      try {
        if (encountersRef.current.length === 0) {
          setLoadingEncounters(true);
        }
        const visibleRes = visibleEncounterStatuses.length > 0
          ? await listEncounters({ status: visibleEncounterStatuses, limit: 100 })
          : { data: [], total: 0 };
        if (isMounted.current) {
          const next = mergeEncounterSnapshot(
            visibleRes.data,
            encountersRef.current.filter((encounter) => visibleEncounterStatuses.includes(encounter.status)),
            encounterBoardClock.current.takeChangedSince(snapshotToken),
          );
          const nextSignature = buildEncounterSignature(next);
          if (nextSignature !== encounterDataSignature.current) {
            encounterDataSignature.current = nextSignature;
            encountersRef.current = next;
            setEncounters(next);
          }
        }
      } catch (err) {
        console.error('[HospitalApp] Failed to fetch encounters:', err);
        if (err instanceof ApiError && err.status === 401) return; // handled by auth-expired
        if (err instanceof ApiError && err.status === 403) {
          encounterDataSignature.current = '';
          encountersRef.current = [];
          setEncounters([]);
          showToast('You do not have access to the encounter list for this session.', 'error');
          return;
        }
        if (err instanceof ApiError && err.status === 429) {
          const retryAfterSeconds = getRetryAfterSeconds(err.body);
          const now = Date.now();
          if (now >= encounterRateLimitToastAt.current) {
            const retryText = retryAfterSeconds ? ` Retrying will be available in about ${retryAfterSeconds} seconds.` : '';
            showToast(`Patient list is temporarily rate-limited. Existing cards will stay visible.${retryText}`, 'error');
            encounterRateLimitToastAt.current = now + Math.max((retryAfterSeconds ?? 10) * 1000, 10_000);
          }
          return;
        }
        showToast('Failed to load encounters. Please try again.', 'error');
      } finally {
        if (encounterFetchInFlight.current?.key === fetchKey) {
          encounterFetchInFlight.current = null;
        }
        lastEncounterFetch.current = { key: fetchKey, completedAt: Date.now() };
        if (isMounted.current) {
          setLoadingEncounters(false);
        }
      }
    })();

    encounterFetchInFlight.current = { key: fetchKey, promise: request };
    return request;
  }, [hospitalConfig, loadingConfig, showToast, user, visibleEncounterStatuses, visibleEncounterStatusesKey]);

  const scheduleFetchEncounters = useCallback((delayMs = 750) => {
    if (encounterRefreshTimer.current !== null) {
      window.clearTimeout(encounterRefreshTimer.current);
    }

    encounterRefreshTimer.current = window.setTimeout(() => {
      encounterRefreshTimer.current = null;
      void fetchEncounters({ force: true });
    }, delayMs);
  }, [fetchEncounters]);

  const refreshEncounters = useCallback(() => {
    void fetchEncounters({ force: true });
  }, [fetchEncounters]);

  const applyEncounterDelta = useCallback(async (encounterId: number) => {
    const refreshToken = encounterBoardClock.current.encounterChanged(encounterId);
    try {
      const encounter = await getEncounter(encounterId);
      if (!encounterBoardClock.current.isCurrentRefresh(encounterId, refreshToken)) return;
      setEncounters((current) => {
        const next = !visibleEncounterStatuses.includes(encounter.status)
          ? current.filter((item) => item.id !== encounter.id)
          : (() => {
              const existing = current.findIndex((item) => item.id === encounter.id);
              if (existing < 0) {
                return [...current, encounter];
              }
              const updated = [...current];
              updated[existing] = encounter;
              return updated;
            })();

        encountersRef.current = next;
        encounterDataSignature.current = buildEncounterSignature(next);
        return next;
      });
    } catch {
      scheduleFetchEncounters();
    }
  }, [scheduleFetchEncounters, visibleEncounterStatuses]);

  const upsertChatMessage = useCallback((message: Message) => {
    const nextMessage = messageToChatMessage(message);
    setChatMessages((prev) => {
      const existing = prev[nextMessage.encounterId] || [];
      if (existing.some((item) => item.id === nextMessage.id)) {
        messageCursorByEncounter.current.set(
          nextMessage.encounterId,
          getLastChatMessageId(existing),
        );
        return prev;
      }

      const merged = appendUniqueChatMessages(existing, [nextMessage]);
      messageCursorByEncounter.current.set(nextMessage.encounterId, getLastChatMessageId(merged));
      return {
        ...prev,
        [nextMessage.encounterId]: merged,
      };
    });
  }, []);

  useEffect(() => {
    const encounterIds = encounters
      .filter((encounter) => !encounter.clinicalFieldsRedacted)
      .map((encounter) => encounter.id)
      .sort((left, right) => left - right);
    encounterIdsRef.current = encounterIds;
    const nextKey = encounterIds.join(',');
    if (!user || nextKey === realtimeSubscriptionKey.current) {
      return;
    }
    realtimeSubscriptionKey.current = nextKey;
    void subscribeToEncounterRealtime(encounterIds).catch(() => {
      realtimeSubscriptionKey.current = '';
    });
  }, [encounters, user]);

  const loadMessagesForEncounter = useCallback(async (encounterId: number, mode: 'replace' | 'append' = 'replace') => {
    const encounter = encountersRef.current.find((item) => item.id === encounterId);
    if (!clinicalMessagingEnabled || encounter?.clinicalFieldsRedacted) {
      return;
    }

    const now = Date.now();
    const retryAt = messageRetryAt.current.get(encounterId) ?? 0;
    if (loadingMessageEncounters.current.has(encounterId) || now < retryAt) {
      return;
    }

    loadingMessageEncounters.current.add(encounterId);
    try {
      const currentCursor = messageCursorByEncounter.current.get(encounterId) ?? null;
      const historyLoaded = loadedMessageEncounters.current.has(encounterId);
      if (mode === 'append' && currentCursor == null && !historyLoaded) {
        return;
      }

      const shouldAppend = mode === 'append';
      const res = await listMessages(encounterId, {
        limit: 100,
        ...(shouldAppend ? { afterMessageId: currentCursor ?? 0 } : {}),
      });
      const nextMessages = res.data.map((message) => messageToChatMessage({ ...message, encounterId }));
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

        const existing = prev[encounterId] || [];
        const merged = appendUniqueChatMessages(nextMessages, existing);
        messageCursorByEncounter.current.set(encounterId, getLastChatMessageId(merged));
        return {
          ...prev,
          [encounterId]: merged,
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
  }, [clinicalMessagingEnabled, showToast]);

  // Fetch once for hydration, then keep every authorized hospital workspace
  // synchronized for the full authenticated session.
  useEffect(() => {
    if (!user || hospitalConfig === null || loadingConfig) return;
    isMounted.current = true;

    void fetchEncounters();

    const socket = getSocket();
    const handleConnect = () => {
      setRealtimeConnected(true);
      scheduleFetchEncounters(0);
      const encounterIds = encounterIdsRef.current;
      if (encounterIds.length > 0) {
        realtimeSubscriptionKey.current = encounterIds.join(',');
        void subscribeToEncounterRealtime(encounterIds).catch(() => {
          realtimeSubscriptionKey.current = '';
        });
      }
      for (const encounterId of loadedMessageEncounters.current) {
        void loadMessagesForEncounter(encounterId, 'append');
      }
    };
    const handleDisconnect = () => {
      setRealtimeConnected(false);
    };
    const handleEncounterUpdate = (payload: { eventId?: number; encounterId: number }) => {
      if (!rememberRealtimeEvent(seenRealtimeEventIds.current, payload.eventId)) return;
      void applyEncounterDelta(payload.encounterId);
    };
    const handleMessageCreated = (payload: { eventId?: number; encounterId: number; message?: Message }) => {
      if (!rememberRealtimeEvent(seenRealtimeEventIds.current, payload.eventId)) return;
      if (payload.message) {
        upsertChatMessage({ ...payload.message, encounterId: payload.encounterId });
        return;
      }

      // Backward-compatible fallback for servers that emit only a message id.
      void loadMessagesForEncounter(payload.encounterId, 'append');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on(RealtimeEvents.EncounterUpdated, handleEncounterUpdate);
    socket.on(RealtimeEvents.MessageCreated, handleMessageCreated);
    if (socket.connected) {
      handleConnect();
    } else {
      connectSocket();
    }

    return () => {
      isMounted.current = false;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off(RealtimeEvents.EncounterUpdated, handleEncounterUpdate);
      socket.off(RealtimeEvents.MessageCreated, handleMessageCreated);
      if (encounterRefreshTimer.current !== null) {
        window.clearTimeout(encounterRefreshTimer.current);
        encounterRefreshTimer.current = null;
      }
    };
  }, [
    user,
    hospitalConfig,
    loadingConfig,
    fetchEncounters,
    loadMessagesForEncounter,
    applyEncounterDelta,
    scheduleFetchEncounters,
    upsertChatMessage,
  ]);

  // If a proxy or network blocks WebSockets, reconcile over REST until Socket.IO
  // reconnects. Focus also triggers an immediate catch-up after a sleeping tab.
  useEffect(() => {
    if (!user || hospitalConfig === null || realtimeConnected) return;

    let messageOffset = 0;
    const reconcile = () => {
      void fetchEncounters({ force: true });
      const encounterIds = [...loadedMessageEncounters.current];
      const batchSize = Math.min(MESSAGE_FALLBACK_BATCH_SIZE, encounterIds.length);
      for (let index = 0; index < batchSize; index += 1) {
        const encounterId = encounterIds[(messageOffset + index) % encounterIds.length];
        void loadMessagesForEncounter(encounterId, 'append');
      }
      if (encounterIds.length > 0) {
        messageOffset = (messageOffset + batchSize) % encounterIds.length;
      }
    };
    const timer = window.setInterval(reconcile, REALTIME_FALLBACK_REFRESH_MS);
    window.addEventListener('focus', reconcile);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', reconcile);
    };
  }, [fetchEncounters, hospitalConfig, loadMessagesForEncounter, realtimeConnected, user]);

  const handleSendMessage = useCallback(async (encounterId: number, text: string) => {
    if (!clinicalMessagingEnabled) {
      showToast('Clinical messaging is available to nurses, doctors, and admins.', 'info');
      throw new Error('Clinical messaging is not available for this role');
    }

    try {
      const created = await sendMessage(encounterId, { content: text });
      upsertChatMessage({ ...created, encounterId });
    } catch (err) {
      console.error('[HospitalApp] Failed to send message:', err);
      // The server may have saved a message even if its response was lost.
      // Refresh the thread and let the clinician inspect it before retrying.
      void loadMessagesForEncounter(
        encounterId,
        loadedMessageEncounters.current.has(encounterId) ? 'append' : 'replace',
      );
      throw err;
    }
  }, [clinicalMessagingEnabled, loadMessagesForEncounter, showToast, upsertChatMessage]);

  // Admittance shows EXPECTED and ADMITTED patients
  const admitEncounters = useMemo(
    () => encounters.filter((e) => e.status === 'EXPECTED' || e.status === 'ADMITTED'),
    [encounters],
  );

  // Triage shows TRIAGE patients
  const triageEncounters = useMemo(
    () => encounters.filter((e) => e.status === 'TRIAGE' && !e.clinicalFieldsRedacted),
    [encounters],
  );

  // Waiting room shows patients that completed triage and are waiting or seen
  const waitingEncounters = useMemo(
    () => encounters.filter((e) =>
      (e.status === 'WAITING' || e.status === 'COMPLETE') && !e.clinicalFieldsRedacted,
    ),
    [encounters],
  );

  useEffect(() => {
    if (!clinicalMessagingEnabled || currentView !== 'waiting' || !availableViews.includes('waiting')) return;
    for (const encounter of waitingEncounters) {
      if (!loadedMessageEncounters.current.has(encounter.id)) {
        void loadMessagesForEncounter(encounter.id, 'replace');
      }
    }
  }, [availableViews, clinicalMessagingEnabled, currentView, loadMessagesForEncounter, waitingEncounters]);

  // ─── Show loading spinner while checking stored token ───────────────────

  if (initializing || (user && hospitalConfig === null)) {
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
      await fetchEncounters({ force: true });
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
      await fetchEncounters({ force: true });
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

  if (effectiveConfig.workflowProfile === 'CLINIC_APPOINTMENT' || import.meta.env.VITE_CLINIC_PILOT_MODE === 'true') {
    const clinicViews = availableViews.filter((view): view is ClinicView => view === 'admit' || view === 'care' || view === 'analytics' || view === 'settings');
    const clinicView: ClinicView = (currentView === 'care' || currentView === 'analytics' || currentView === 'settings') && clinicViews.includes(currentView) ? currentView : 'admit';
    return (
      <ClinicToastProvider>
        <ClinicShell current={clinicView} views={clinicViews} onNavigate={setCurrentView} onLogout={handleBack} user={userInfo!} clinicName={user.hospital?.name}>
          {clinicView === 'care' ? <CareView />
            : clinicView === 'analytics' ? <ClinicAnalyticsView />
            : clinicView === 'settings' ? <SettingsPage embedded onNavigate={(view) => { if (clinicViews.includes(view as ClinicView)) setCurrentView(view); }} onLogout={handleBack} user={user} availableViews={clinicViews} configEnvelope={{ hospitalId: user.hospitalId, updatedAt: configUpdatedAt, config: effectiveConfig }} onConfigUpdated={handleConfigUpdated} />
              : <ClinicReceptionBoard user={userInfo!} />}
        </ClinicShell>
      </ClinicToastProvider>
    );
  }

  return (
    <>
      {currentView === 'admit' && (
        <AdmitView
          onBack={handleBack}
          onNavigate={handleNavigate}
          encounters={admitEncounters}
          onAdmit={handleAdmit}
          loading={loadingEncounters}
          onRefresh={refreshEncounters}
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
          onRefresh={refreshEncounters}
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
          onRefresh={refreshEncounters}
          user={userInfo}
          availableViews={availableViews}
          realtimeActive={realtimeConnected}
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
