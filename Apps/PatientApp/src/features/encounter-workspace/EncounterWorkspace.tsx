import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

import { cancelMyEncounter, getMyEncounter, getQueueInfo, listMyMessages, sendPatientMessage } from '../../shared/api/encounters';
import { updateProfile } from '../../shared/api/auth';
import { ENCOUNTER_STATUS_META, isInHospitalEncounter, isTerminalEncounter } from '../../shared/encounters';
import { useDemo } from '../../shared/demo';
import { useAuth } from '../../shared/hooks/useAuth';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import type { Encounter, EncounterWorkspaceTab, Message, QueueInfo } from '../../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../../shared/ui/theme';
import { useToast } from '../../shared/ui/ToastContext';

const ENCOUNTER_POLL_MS = 10_000;
const MESSAGE_POLL_MS = 5_000;
const QUEUE_POLL_MS = 30_000;

const terminalStates = new Set(['COMPLETE', 'UNRESOLVED', 'CANCELLED']);

function formatHospitalName(slug: string | null | undefined): string {
  if (!slug) {
    return 'Priage General Hospital';
  }
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function resolveActiveTab(pathname: string): EncounterWorkspaceTab {
  if (pathname.endsWith('/chat')) return 'chat';
  if (pathname.endsWith('/profile')) return 'profile';
  return 'current';
}

function labelFromStatus(status: Encounter['status']) {
  return ENCOUNTER_STATUS_META[status] ?? ENCOUNTER_STATUS_META.EXPECTED;
}

function formatTime(timestamp: string | null): string {
  if (!timestamp) return 'Not yet';
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateTime(timestamp: string | null): string {
  if (!timestamp) return 'Pending';
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getLatestCareInstruction(messages: Message[]): string {
  const reversed = [...messages].reverse();
  const latest = reversed.find((message) => message.senderType === 'USER');
  if (!latest) {
    return 'Your care team will send updates here as your visit progresses.';
  }
  return latest.content;
}

function TerminalBanner({ status }: { status: Encounter['status'] }) {
  const content: Record<Encounter['status'], string> = {
    EXPECTED: '',
    ADMITTED: '',
    TRIAGE: '',
    WAITING: '',
    COMPLETE: 'This visit has been marked complete. You can still review details and messages below.',
    UNRESOLVED: 'This visit ended without full resolution. Review follow-up instructions in your profile tab.',
    CANCELLED: 'This visit was cancelled. You can start a new visit whenever needed.',
  };

  if (!terminalStates.has(status)) return null;

  return (
    <div style={styles.terminalBanner}>
      <strong style={styles.terminalTitle}>Visit update:</strong> {content[status]}
    </div>
  );
}

export function EncounterWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { session: authSession, patient, refreshProfile, logout } = useAuth();
  const { session: guestSession, clearSession } = useGuestSession();
  const {
    selectedScenario,
    quickReplies,
    checklistItems,
    getEncounterDraft,
    updateEncounterDraft,
    addEncounterAttachment,
    clearEncounterDraft,
    getCareTeamMember,
  } = useDemo();

  const encounterId = Number(id);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [localProfile, setLocalProfile] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    allergies: '',
    conditions: '',
    preferredLanguage: '',
  });
  const [guestProfile, setGuestProfile] = useState({
    preferredName: '',
    emergencyContact: '',
    supportNotes: '',
  });
  const [localSymptomInput, setLocalSymptomInput] = useState('');
  const [localSymptomSeverity, setLocalSymptomSeverity] = useState(5);
  const [localTransportNote, setLocalTransportNote] = useState('');
  const [localMedications, setLocalMedications] = useState('');
  const [localAccessibility, setLocalAccessibility] = useState('');
  const [restartingDemo, setRestartingDemo] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isGuest = !authSession && !!guestSession;
  const activeTab = resolveActiveTab(location.pathname);
  const statusMeta = labelFromStatus(encounter?.status ?? 'EXPECTED');
  const hospitalName = useMemo(() => {
    if (guestSession?.hospitalSlug) {
      return formatHospitalName(guestSession.hospitalSlug);
    }
    return selectedScenario.hospitalName;
  }, [guestSession?.hospitalSlug, selectedScenario.hospitalName]);

  const draft = useMemo(() => {
    if (!encounterId || Number.isNaN(encounterId)) {
      return null;
    }
    return getEncounterDraft(encounterId);
  }, [encounterId, getEncounterDraft]);

  useEffect(() => {
    if (!encounterId || Number.isNaN(encounterId)) {
      return;
    }
    if (!draft) {
      return;
    }
    setLocalSymptomInput(draft.symptomUpdate);
    setLocalSymptomSeverity(draft.symptomSeverity);
    setLocalTransportNote(draft.transportNote);
    setLocalMedications(draft.medications);
    setLocalAccessibility(draft.accessibilityNeeds);
    setGuestProfile((previous) => ({
      ...previous,
      emergencyContact: draft.emergencyContact,
      supportNotes: draft.supportPerson,
    }));
  }, [draft, encounterId]);

  useEffect(() => {
    if (!patient) {
      return;
    }
    setLocalProfile({
      firstName: patient.firstName ?? '',
      lastName: patient.lastName ?? '',
      phone: patient.phone ?? '',
      allergies: patient.allergies ?? '',
      conditions: patient.conditions ?? '',
      preferredLanguage: patient.preferredLanguage ?? '',
    });
  }, [patient]);

  const handleSessionExpired = useCallback(() => {
    if (isGuest) {
      clearSession();
      navigate('/welcome', { replace: true });
      return;
    }
    navigate('/auth/login', { replace: true });
  }, [clearSession, isGuest, navigate]);

  const refreshEncounter = useCallback(async (showFailureToast = false) => {
    if (!encounterId || Number.isNaN(encounterId)) {
      return;
    }

    try {
      const detail = await getMyEncounter(encounterId);
      setEncounter(detail);

      if (isGuest && detail.status === 'EXPECTED') {
        navigate(`/guest/enroute/${encounterId}`, { replace: true });
      }
    } catch {
      if (showFailureToast) {
        showToast('Could not load this visit anymore. Returning to start.');
      }
      handleSessionExpired();
    } finally {
      setLoading(false);
    }
  }, [encounterId, handleSessionExpired, isGuest, navigate, showToast]);

  const refreshMessages = useCallback(async () => {
    if (!encounterId || Number.isNaN(encounterId)) return;
    try {
      const nextMessages = await listMyMessages(encounterId);
      setMessages(nextMessages);
    } catch {
      // Keep background polling silent to avoid toast spam.
    }
  }, [encounterId]);

  useEffect(() => {
    if (!encounterId || Number.isNaN(encounterId)) {
      setLoading(false);
      return;
    }

    void refreshEncounter(true);
    void refreshMessages();

    const encounterInterval = setInterval(() => {
      void refreshEncounter();
    }, ENCOUNTER_POLL_MS);
    const messageInterval = setInterval(() => {
      void refreshMessages();
    }, MESSAGE_POLL_MS);

    return () => {
      clearInterval(encounterInterval);
      clearInterval(messageInterval);
    };
  }, [encounterId, refreshEncounter, refreshMessages]);

  useEffect(() => {
    if (!encounter || !['WAITING', 'TRIAGE'].includes(encounter.status)) {
      setQueueInfo(null);
      return;
    }

    const activeEncounterId = encounter.id;
    let cancelled = false;

    async function loadQueue() {
      try {
        const queue = await getQueueInfo(activeEncounterId);
        if (!cancelled) setQueueInfo(queue);
      } catch {
        if (!cancelled) setQueueInfo(null);
      }
    }

    void loadQueue();
    const interval = setInterval(() => {
      void loadQueue();
    }, QUEUE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [encounter]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeTab]);

  if (!authSession && !guestSession) {
    return <Navigate to="/welcome" replace />;
  }

  if (!encounterId || Number.isNaN(encounterId)) {
    return <Navigate to={authSession ? '/' : '/welcome'} replace />;
  }

  if (guestSession?.encounterId && guestSession.encounterId !== encounterId) {
    return <Navigate to={`/encounters/${guestSession.encounterId}/current`} replace />;
  }

  if (loading || !encounter) {
    return (
      <div style={styles.loadingShell}>
        <div style={styles.spinner} />
        <p style={styles.loadingLabel}>Preparing your visit workspace...</p>
      </div>
    );
  }

  const currentEncounter = encounter;
  const isTerminal = isTerminalEncounter(encounter.status);
  const inHospital = isInHospitalEncounter(encounter.status);
  const checklistSelection = new Set(draft?.selectedChecklistIds ?? []);
  const primaryDescription = inHospital
    ? 'Your care team has your details and this workspace updates as your visit progresses.'
    : 'You are checked in and on the way. Keep this page open for live updates.';

  async function handleSendMessage(content: string, isWorsening = false) {
    const trimmed = content.trim();
    if (!trimmed || sendingMessage || isTerminal) return;

    setSendingMessage(true);
    try {
      await sendPatientMessage(currentEncounter.id, trimmed, isWorsening);
      setMessageInput('');
      await refreshMessages();
      if (isWorsening) {
        showToast('Worsening alert sent to your care team.', 'success');
      }
    } catch {
      showToast('Failed to send message.');
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleSaveProfile() {
    if (!authSession) {
      if (encounterId) {
        updateEncounterDraft(encounterId, {
          emergencyContact: guestProfile.emergencyContact,
          supportPerson: guestProfile.supportNotes,
        });
      }
      showToast('Guest visit details updated locally for the demo.', 'success');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        firstName: localProfile.firstName || undefined,
        lastName: localProfile.lastName || undefined,
        phone: localProfile.phone || undefined,
        allergies: localProfile.allergies || undefined,
        conditions: localProfile.conditions || undefined,
        preferredLanguage: localProfile.preferredLanguage || undefined,
      });
      await refreshProfile();
      showToast('Profile updated.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  function handleChecklistToggle(itemId: string) {
    if (!draft) return;
    const set = new Set(draft.selectedChecklistIds);
    if (set.has(itemId)) set.delete(itemId);
    else set.add(itemId);
    updateEncounterDraft(currentEncounter.id, {
      selectedChecklistIds: Array.from(set),
    });
  }

  function handleAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    addEncounterAttachment(currentEncounter.id, file.name);
    showToast('Attachment saved to demo visit timeline.', 'success');
    event.target.value = '';
  }

  function saveSymptomUpdate() {
    if (!localSymptomInput.trim()) {
      showToast('Add a short symptom update before saving.');
      return;
    }
    updateEncounterDraft(currentEncounter.id, {
      symptomUpdate: localSymptomInput.trim(),
      symptomSeverity: localSymptomSeverity,
    });
    showToast('Symptom update saved locally for demo review.', 'success');
  }

  function saveVisitNotes() {
    updateEncounterDraft(currentEncounter.id, {
      transportNote: localTransportNote,
      medications: localMedications,
      accessibilityNeeds: localAccessibility,
    });
    showToast('Visit notes saved.', 'success');
  }

  const latestInstruction = getLatestCareInstruction(messages);

  async function handleRestartDemo() {
    if (restartingDemo) return;
    setRestartingDemo(true);
    try {
      if (guestSession && !authSession) {
        try {
          await cancelMyEncounter(currentEncounter.id);
        } catch {
          // Continue with reset even if cancellation fails.
        }
        clearSession();
        navigate('/welcome', { replace: true });
        return;
      }

      await logout().catch(() => undefined);
      clearSession();
      navigate('/welcome', { replace: true });
    } finally {
      setRestartingDemo(false);
    }
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.hospitalPill}>{hospitalName}</div>
          <div style={styles.headerControls}>
            <span style={{ ...styles.statusPill, color: statusMeta.color, background: statusMeta.bg, borderColor: statusMeta.border }}>
              {statusMeta.shortLabel}
            </span>
            <button style={styles.restartButton} onClick={handleRestartDemo} disabled={restartingDemo}>
              {restartingDemo ? 'Restarting…' : 'Restart Demo'}
            </button>
          </div>
        </div>
        <h1 style={styles.headerTitle}>{currentEncounter.chiefComplaint ?? 'Emergency Visit'}</h1>
        <p style={styles.headerSubtitle}>{primaryDescription}</p>
      </header>

      <TerminalBanner status={currentEncounter.status} />

      <nav style={styles.topTabs}>
        <TabLink encounterId={currentEncounter.id} tab="current" active={activeTab === 'current'} label="Current Visit" />
        <TabLink encounterId={currentEncounter.id} tab="chat" active={activeTab === 'chat'} label="Messages" />
        <TabLink encounterId={currentEncounter.id} tab="profile" active={activeTab === 'profile'} label="Profile" />
      </nav>

      <div style={styles.tabBody}>
        <Routes>
          <Route
            path="current"
            element={(
              <section style={styles.contentStack}>
                <Card title="Visit Snapshot" subtitle="Live encounter status from the hospital">
                  <div style={styles.snapshotGrid}>
                    <SnapshotItem label="Status" value={statusMeta.label} />
                    <SnapshotItem label="Registered" value={formatDateTime(currentEncounter.expectedAt)} />
                    <SnapshotItem label="Arrived" value={formatDateTime(currentEncounter.arrivedAt)} />
                    <SnapshotItem
                      label="Estimated Wait"
                      value={queueInfo ? `${queueInfo.estimatedMinutes} min` : 'Will appear when queued'}
                    />
                  </div>
                </Card>

                <Card title="Latest Care-Team Instruction" subtitle="From your current message thread">
                  <p style={styles.bodyText}>{latestInstruction}</p>
                </Card>

                <Card title="Symptom Progression" subtitle="Demo-local note that remains editable">
                  <textarea
                    value={localSymptomInput}
                    onChange={(event) => setLocalSymptomInput(event.target.value)}
                    placeholder="Describe any change in pain, dizziness, breathing, or discomfort."
                    style={styles.textArea}
                    disabled={isTerminal}
                  />
                  <label style={styles.fieldLabel}>
                    Symptom severity: {localSymptomSeverity}/10
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={localSymptomSeverity}
                      onChange={(event) => setLocalSymptomSeverity(Number(event.target.value))}
                      disabled={isTerminal}
                      style={styles.slider}
                    />
                  </label>
                  <button style={styles.primaryButton} onClick={saveSymptomUpdate} disabled={isTerminal}>
                    Save symptom update
                  </button>
                </Card>

                <Card title="Forms & Checklist" subtitle="Demo checklist for bedside workflow">
                  <div style={styles.checklistStack}>
                    {checklistItems.map((item) => {
                      const checked = checklistSelection.has(item.id);
                      return (
                        <button
                          key={item.id}
                          style={{ ...styles.checklistItem, background: checked ? '#e8f1ff' : '#fffdf8' }}
                          onClick={() => handleChecklistToggle(item.id)}
                          disabled={isTerminal}
                        >
                          <span style={{ ...styles.checkCircle, borderColor: checked ? patientTheme.colors.accent : '#b8af9d' }}>
                            {checked ? '✓' : ''}
                          </span>
                          <span>
                            <strong style={styles.checkLabel}>{item.label}</strong>
                            <small style={styles.checkDetail}>{item.description}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Card>

                <Card title="Attachments & Evidence" subtitle="Photo upload with local preview cards for demo">
                  <label style={styles.uploadLabel}>
                    Add photo or document
                    <input type="file" onChange={handleAttachment} style={styles.fileInput} disabled={isTerminal} />
                  </label>
                  <div style={styles.attachmentList}>
                    {draft?.attachments.length ? (
                      draft.attachments.map((attachment) => (
                        <div key={attachment.id} style={{ ...styles.attachmentCard, background: attachment.tint }}>
                          <strong>{attachment.name}</strong>
                          <span>{attachment.note}</span>
                        </div>
                      ))
                    ) : (
                      <p style={styles.mutedText}>No demo attachments yet.</p>
                    )}
                  </div>
                </Card>

                <Card title="Support & Logistics" subtitle="Demo-only cards to show broader patient support">
                  <div style={styles.fieldStack}>
                    <label style={styles.fieldLabel}>
                      Transport / arrival notes
                      <textarea
                        value={localTransportNote}
                        onChange={(event) => setLocalTransportNote(event.target.value)}
                        placeholder="Example: arriving by rideshare, spouse waiting in parking lot."
                        style={styles.textArea}
                      />
                    </label>
                    <label style={styles.fieldLabel}>
                      Current medications
                      <input
                        value={localMedications}
                        onChange={(event) => setLocalMedications(event.target.value)}
                        placeholder="Example: Metformin 500mg twice daily"
                        style={styles.input}
                      />
                    </label>
                    <label style={styles.fieldLabel}>
                      Accessibility preferences
                      <input
                        value={localAccessibility}
                        onChange={(event) => setLocalAccessibility(event.target.value)}
                        placeholder="Example: hearing support, low-noise seating"
                        style={styles.input}
                      />
                    </label>
                    <button style={styles.secondaryButton} onClick={saveVisitNotes}>
                      Save visit notes
                    </button>
                  </div>
                </Card>
              </section>
            )}
          />
          <Route
            path="chat"
            element={(
              <section style={styles.contentStack}>
                <Card title="Care-Team Conversation" subtitle="Polling every 5 seconds from your live encounter thread">
                  <div style={styles.quickReplyRow}>
                    {quickReplies.map((reply) => (
                      <button
                        key={reply.id}
                        style={styles.quickReplyChip}
                        onClick={() => {
                          void handleSendMessage(reply.message, Boolean(reply.isWorsening));
                        }}
                        disabled={sendingMessage || isTerminal}
                      >
                        {reply.label}
                      </button>
                    ))}
                  </div>
                  <div style={styles.messageList}>
                    {messages.length === 0 && (
                      <p style={styles.mutedText}>No messages yet. Use quick replies or type below.</p>
                    )}
                    {messages.map((message) => {
                      const isPatientMessage = message.senderType === 'PATIENT';
                      const sender = isPatientMessage ? null : getCareTeamMember(message.createdByUserId);
                      return (
                        <div
                          key={message.id}
                          style={{
                            ...styles.messageBubble,
                            alignSelf: isPatientMessage ? 'flex-end' : 'flex-start',
                            background: isPatientMessage ? '#1949b8' : '#f3efe5',
                            color: isPatientMessage ? '#fff' : patientTheme.colors.ink,
                          }}
                        >
                          <div style={styles.messageMeta}>
                            {isPatientMessage ? (
                              <span>You</span>
                            ) : (
                              <span>{sender ? `${sender.name} • ${sender.badge}` : 'Care Team'}</span>
                            )}
                            <time>{formatTime(message.createdAt)}</time>
                          </div>
                          <p style={styles.messageText}>{message.content}</p>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                  {isTerminal ? (
                    <p style={styles.closedNotice}>This visit has ended. Messaging is read-only now.</p>
                  ) : (
                    <div style={styles.inputRow}>
                      <input
                        value={messageInput}
                        onChange={(event) => setMessageInput(event.target.value)}
                        placeholder="Type a message to your care team"
                        style={styles.input}
                        disabled={sendingMessage}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void handleSendMessage(messageInput);
                          }
                        }}
                      />
                      <button
                        style={styles.primaryButton}
                        onClick={() => {
                          void handleSendMessage(messageInput);
                        }}
                        disabled={!messageInput.trim() || sendingMessage}
                      >
                        Send
                      </button>
                    </div>
                  )}
                </Card>
              </section>
            )}
          />
          <Route
            path="profile"
            element={(
              <section style={styles.contentStack}>
                <Card title="Patient Information" subtitle={authSession ? 'Account-backed profile details' : 'Guest visit profile'}>
                  {authSession ? (
                    <div style={styles.fieldStack}>
                      <TwoColField
                        leftLabel="First name"
                        leftValue={localProfile.firstName}
                        onLeftChange={(value) => setLocalProfile((prev) => ({ ...prev, firstName: value }))}
                        rightLabel="Last name"
                        rightValue={localProfile.lastName}
                        onRightChange={(value) => setLocalProfile((prev) => ({ ...prev, lastName: value }))}
                      />
                      <label style={styles.fieldLabel}>
                        Phone
                        <input
                          value={localProfile.phone}
                          onChange={(event) => setLocalProfile((prev) => ({ ...prev, phone: event.target.value }))}
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.fieldLabel}>
                        Allergies
                        <input
                          value={localProfile.allergies}
                          onChange={(event) => setLocalProfile((prev) => ({ ...prev, allergies: event.target.value }))}
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.fieldLabel}>
                        Conditions
                        <input
                          value={localProfile.conditions}
                          onChange={(event) => setLocalProfile((prev) => ({ ...prev, conditions: event.target.value }))}
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.fieldLabel}>
                        Preferred language
                        <input
                          value={localProfile.preferredLanguage}
                          onChange={(event) => setLocalProfile((prev) => ({ ...prev, preferredLanguage: event.target.value }))}
                          style={styles.input}
                        />
                      </label>
                    </div>
                  ) : (
                    <div style={styles.fieldStack}>
                      <label style={styles.fieldLabel}>
                        Preferred name
                        <input
                          value={guestProfile.preferredName}
                          onChange={(event) => setGuestProfile((prev) => ({ ...prev, preferredName: event.target.value }))}
                          placeholder={selectedScenario.guestStartDefaults?.firstName ?? 'Guest'}
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.fieldLabel}>
                        Emergency contact
                        <input
                          value={guestProfile.emergencyContact}
                          onChange={(event) => setGuestProfile((prev) => ({ ...prev, emergencyContact: event.target.value }))}
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.fieldLabel}>
                        Support notes
                        <textarea
                          value={guestProfile.supportNotes}
                          onChange={(event) => setGuestProfile((prev) => ({ ...prev, supportNotes: event.target.value }))}
                          style={styles.textArea}
                        />
                      </label>
                    </div>
                  )}
                  <div style={styles.buttonRow}>
                    <button style={styles.primaryButton} onClick={handleSaveProfile} disabled={savingProfile}>
                      {savingProfile ? 'Saving...' : authSession ? 'Save profile changes' : 'Save guest visit details'}
                    </button>
                    {!authSession && (
                      <button style={styles.secondaryButton} onClick={() => navigate('/auth/signup')}>
                        Create account after visit
                      </button>
                    )}
                  </div>
                </Card>

                <Card title="Care Team Roster" subtitle="Demo display identities mapped from staff messages">
                  <div style={styles.rosterGrid}>
                    {[1, 2, 3, 4].map((index) => {
                      const member = getCareTeamMember(index);
                      if (!member) return null;
                      return (
                        <div key={member.userId} style={styles.rosterCard}>
                          <span style={{ ...styles.avatar, background: `${member.color}22`, color: member.color }}>
                            {member.avatarInitials}
                          </span>
                          <div>
                            <strong style={styles.rosterName}>{member.name}</strong>
                            <small style={styles.rosterRole}>{member.role}</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {authSession && (
                  <Card title="Account Actions" subtitle="Demo utility actions for walkthrough speed">
                    <div style={styles.buttonRow}>
                      <button style={styles.secondaryButton} onClick={() => navigate('/priage')}>
                        Start new visit
                      </button>
                      <button
                        style={{ ...styles.secondaryButton, borderColor: '#fecaca', color: '#b93b35' }}
                        onClick={async () => {
                          await logout().catch(() => undefined);
                        }}
                      >
                        Log out
                      </button>
                    </div>
                  </Card>
                )}

                <Card title="Demo Draft Controls" subtitle="Resets local-only high-fidelity additions">
                  <button
                    style={styles.secondaryButton}
                    onClick={() => {
                      clearEncounterDraft(currentEncounter.id);
                      showToast('Local demo draft reset for this encounter.');
                    }}
                  >
                    Reset local demo draft
                  </button>
                </Card>
              </section>
            )}
          />
          <Route path="*" element={<Navigate to={`/encounters/${currentEncounter.id}/current`} replace />} />
        </Routes>
      </div>
    </div>
  );
}

function TabLink({
  encounterId,
  tab,
  active,
  label,
}: {
  encounterId: number;
  tab: EncounterWorkspaceTab;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      to={`/encounters/${encounterId}/${tab}`}
      style={{
        ...styles.tabLink,
        color: active ? patientTheme.colors.accentStrong : patientTheme.colors.inkMuted,
        borderBottomColor: active ? patientTheme.colors.accent : 'transparent',
      }}
    >
      {label}
    </Link>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article style={styles.card}>
      <header style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>{title}</h3>
        <p style={styles.cardSubtitle}>{subtitle}</p>
      </header>
      {children}
    </article>
  );
}

function SnapshotItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.snapshotItem}>
      <span style={styles.snapshotLabel}>{label}</span>
      <strong style={styles.snapshotValue}>{value}</strong>
    </div>
  );
}

function TwoColField({
  leftLabel,
  leftValue,
  onLeftChange,
  rightLabel,
  rightValue,
  onRightChange,
}: {
  leftLabel: string;
  leftValue: string;
  onLeftChange: (value: string) => void;
  rightLabel: string;
  rightValue: string;
  onRightChange: (value: string) => void;
}) {
  return (
    <div style={styles.twoCol}>
      <label style={styles.fieldLabel}>
        {leftLabel}
        <input value={leftValue} onChange={(event) => onLeftChange(event.target.value)} style={styles.input} />
      </label>
      <label style={styles.fieldLabel}>
        {rightLabel}
        <input value={rightValue} onChange={(event) => onRightChange(event.target.value)} style={styles.input} />
      </label>
    </div>
  );
}

const sharedInput: CSSProperties = {
  width: '100%',
  border: panelBorder,
  borderRadius: patientTheme.radius.sm,
  background: '#fff',
  color: patientTheme.colors.ink,
  fontSize: '0.94rem',
  padding: '0.68rem 0.74rem',
  fontFamily: patientTheme.fonts.body,
  boxSizing: 'border-box',
};

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
    paddingBottom: '1.5rem',
  },
  loadingShell: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    alignItems: 'center',
    justifyContent: 'center',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
  },
  spinner: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    border: '4px solid #dbe3f3',
    borderTopColor: patientTheme.colors.accent,
    animation: 'spin 0.9s linear infinite',
  },
  loadingLabel: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
  },
  header: {
    maxWidth: '920px',
    margin: '0 auto',
    padding: '1.3rem 1rem 1rem',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  hospitalPill: {
    display: 'inline-flex',
    alignItems: 'center',
    border: panelBorder,
    borderRadius: '999px',
    background: '#fff8eb',
    padding: '0.32rem 0.8rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#7a4d14',
  },
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid',
    borderRadius: '999px',
    padding: '0.32rem 0.8rem',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  restartButton: {
    border: '1px solid #fecaca',
    borderRadius: patientTheme.radius.sm,
    background: '#fff1f2',
    color: '#9f1239',
    fontWeight: 700,
    fontSize: '0.74rem',
    padding: '0.4rem 0.65rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  headerTitle: {
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.35rem',
    margin: '0.75rem 0 0',
    letterSpacing: '-0.01em',
  },
  headerSubtitle: {
    margin: '0.35rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.5,
    maxWidth: '58ch',
  },
  terminalBanner: {
    maxWidth: '920px',
    margin: '0 auto 0.8rem',
    padding: '0.75rem 1rem',
    borderRadius: patientTheme.radius.sm,
    background: '#fff1ef',
    border: '1px solid #fecaca',
    color: '#9f1239',
    fontSize: '0.9rem',
  },
  terminalTitle: {
    marginRight: '0.35rem',
  },
  topTabs: {
    maxWidth: '920px',
    margin: '0 auto',
    display: 'flex',
    gap: '0.35rem',
    padding: '0 1rem',
    borderBottom: panelBorder,
    position: 'sticky',
    top: 0,
    backdropFilter: 'blur(4px)',
    background: 'rgba(247, 243, 234, 0.82)',
    zIndex: 10,
  },
  tabLink: {
    textDecoration: 'none',
    padding: '0.86rem 0.68rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    borderBottom: '2px solid transparent',
  },
  tabBody: {
    maxWidth: '920px',
    margin: '0 auto',
    padding: '1rem',
  },
  contentStack: {
    display: 'grid',
    gap: '0.85rem',
  },
  card: {
    background: 'rgba(255, 253, 248, 0.98)',
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    padding: '0.95rem',
    boxShadow: patientTheme.shadows.card,
  },
  cardHeader: {
    marginBottom: '0.75rem',
  },
  cardTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1rem',
  },
  cardSubtitle: {
    margin: '0.2rem 0 0',
    color: patientTheme.colors.inkMuted,
    fontSize: '0.86rem',
    lineHeight: 1.4,
  },
  snapshotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '0.6rem',
  },
  snapshotItem: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    padding: '0.65rem',
    display: 'grid',
    gap: '0.15rem',
  },
  snapshotLabel: {
    fontSize: '0.74rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: patientTheme.colors.inkMuted,
  },
  snapshotValue: {
    fontSize: '0.86rem',
    lineHeight: 1.3,
  },
  bodyText: {
    margin: 0,
    lineHeight: 1.5,
    fontSize: '0.93rem',
  },
  textArea: {
    ...sharedInput,
    minHeight: '88px',
    resize: 'vertical',
  },
  input: sharedInput,
  slider: {
    width: '100%',
    marginTop: '0.35rem',
  },
  fieldLabel: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  fieldStack: {
    display: 'grid',
    gap: '0.65rem',
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.55rem',
    marginTop: '0.65rem',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    padding: '0.65rem 0.95rem',
    background: patientTheme.colors.accent,
    color: '#fff',
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    padding: '0.65rem 0.95rem',
    background: '#fff',
    color: patientTheme.colors.ink,
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    cursor: 'pointer',
  },
  checklistStack: {
    display: 'grid',
    gap: '0.55rem',
  },
  checklistItem: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    padding: '0.55rem 0.65rem',
    display: 'grid',
    gridTemplateColumns: '24px 1fr',
    gap: '0.55rem',
    alignItems: 'flex-start',
    textAlign: 'left',
    fontFamily: patientTheme.fonts.body,
    cursor: 'pointer',
  },
  checkCircle: {
    width: '18px',
    height: '18px',
    border: '2px solid',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 900,
    marginTop: '0.1rem',
    color: patientTheme.colors.accent,
  },
  checkLabel: {
    display: 'block',
    fontSize: '0.88rem',
  },
  checkDetail: {
    display: 'block',
    color: patientTheme.colors.inkMuted,
    marginTop: '0.15rem',
    lineHeight: 1.35,
  },
  uploadLabel: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
  fileInput: {
    ...sharedInput,
    padding: '0.5rem',
  },
  attachmentList: {
    marginTop: '0.65rem',
    display: 'grid',
    gap: '0.5rem',
  },
  attachmentCard: {
    borderRadius: patientTheme.radius.sm,
    padding: '0.6rem 0.7rem',
    border: panelBorder,
    display: 'grid',
    gap: '0.2rem',
    fontSize: '0.82rem',
  },
  mutedText: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.4,
    fontSize: '0.88rem',
  },
  quickReplyRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    marginBottom: '0.7rem',
  },
  quickReplyChip: {
    border: '1px solid #bcd1ff',
    borderRadius: '999px',
    padding: '0.35rem 0.72rem',
    background: '#eef5ff',
    color: patientTheme.colors.accentStrong,
    fontWeight: 700,
    fontSize: '0.77rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  messageList: {
    display: 'grid',
    gap: '0.55rem',
    maxHeight: '340px',
    overflowY: 'auto',
    padding: '0.3rem 0.1rem',
  },
  messageBubble: {
    borderRadius: patientTheme.radius.sm,
    padding: '0.62rem 0.72rem',
    maxWidth: '85%',
    display: 'grid',
    gap: '0.2rem',
  },
  messageMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.69rem',
    opacity: 0.85,
  },
  messageText: {
    margin: 0,
    lineHeight: 1.4,
    fontSize: '0.88rem',
  },
  closedNotice: {
    margin: '0.7rem 0 0',
    fontSize: '0.83rem',
    color: patientTheme.colors.inkMuted,
  },
  inputRow: {
    marginTop: '0.65rem',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '0.5rem',
    alignItems: 'center',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.55rem',
  },
  rosterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.55rem',
  },
  rosterCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    padding: '0.6rem 0.65rem',
    display: 'grid',
    gridTemplateColumns: '36px 1fr',
    gap: '0.55rem',
    alignItems: 'center',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.8rem',
  },
  rosterName: {
    display: 'block',
    fontSize: '0.84rem',
  },
  rosterRole: {
    display: 'block',
    color: patientTheme.colors.inkMuted,
    marginTop: '0.12rem',
    fontSize: '0.75rem',
  },
};
