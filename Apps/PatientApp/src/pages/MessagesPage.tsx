import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { listMyEncounters, listMyMessages, sendPatientMessage } from '../shared/api/encounters';
import { ENCOUNTER_STATUS_META, isActiveEncounter } from '../shared/encounters';
import { appendUniqueMessages, getLastMessageId } from '../shared/messages';
import type { EncounterSummary, Message } from '../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

const ACTIVE_THREAD_POLL_MS = 5000;

export function MessagesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingEncounters, setLoadingEncounters] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedEncounterId, setSelectedEncounterId] = useState<number | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [markWorsening, setMarkWorsening] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCursorRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEncounters() {
      try {
        const data = await listMyEncounters();
        if (!cancelled) {
          setEncounters(data);
        }
      } catch {
        if (!cancelled) {
          showToast('Failed to load conversations.');
        }
      } finally {
        if (!cancelled) {
          setLoadingEncounters(false);
        }
      }
    }

    void loadEncounters();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const activeEncounter = useMemo(
    () => encounters.find((encounter) => isActiveEncounter(encounter.status)) ?? null,
    [encounters],
  );

  const pastEncounters = useMemo(
    () => encounters.filter((encounter) => !isActiveEncounter(encounter.status)),
    [encounters],
  );

  useEffect(() => {
    if (activeEncounter) {
      setSelectedEncounterId(activeEncounter.id);
      if (searchParams.get('encounter')) {
        setSearchParams({}, { replace: true });
      }
      return;
    }

    const requestedId = Number(searchParams.get('encounter'));
    const requestedEncounter = pastEncounters.find((encounter) => encounter.id === requestedId);

    setSelectedEncounterId((current) => {
      if (current && pastEncounters.some((encounter) => encounter.id === current)) {
        return current;
      }
      return requestedEncounter?.id ?? pastEncounters[0]?.id ?? null;
    });
  }, [activeEncounter, pastEncounters, searchParams, setSearchParams]);

  const threadEncounter = activeEncounter
    ?? pastEncounters.find((encounter) => encounter.id === selectedEncounterId)
    ?? null;
  const threadEncounterId = threadEncounter?.id ?? null;

  useEffect(() => {
    messageCursorRef.current = null;
    setMessages([]);
    setLoadingMessages(false);
  }, [threadEncounterId]);

  const loadThreadMessages = useCallback(async (
    encounterId: number,
    mode: 'replace' | 'append' = 'replace',
  ) => {
    if (mode === 'replace') {
      setLoadingMessages(true);
    }

    try {
      const next = await listMyMessages(
        encounterId,
        mode === 'append' ? { afterMessageId: messageCursorRef.current ?? 0 } : {},
      );

      if (mode === 'replace') {
        setMessages(next);
        messageCursorRef.current = getLastMessageId(next);
        return;
      }

      if (next.length === 0) {
        return;
      }

      setMessages((prev) => {
        const merged = appendUniqueMessages(prev, next);
        messageCursorRef.current = getLastMessageId(merged);
        return merged;
      });
    } catch {
      if (mode === 'replace') {
        showToast('Failed to load this message history.');
      }
    } finally {
      if (mode === 'replace') {
        setLoadingMessages(false);
      }
    }
  }, [showToast]);

  useEffect(() => {
    if (!threadEncounterId) {
      return;
    }

    const encounterId = threadEncounterId;

    void loadThreadMessages(encounterId, 'replace');
    const interval = activeEncounter?.id === encounterId
      ? window.setInterval(() => void loadThreadMessages(encounterId, 'append'), ACTIVE_THREAD_POLL_MS)
      : null;

    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [activeEncounter?.id, loadThreadMessages, threadEncounterId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSendMessage() {
    if (!activeEncounter) {
      return;
    }

    const trimmed = draftMessage.trim();
    if (!trimmed || sending) {
      return;
    }

    setSending(true);
    try {
      const sentMessage = await sendPatientMessage(activeEncounter.id, trimmed, markWorsening);
      setDraftMessage('');
      setMarkWorsening(false);
      setMessages((prev) => {
        const merged = appendUniqueMessages(prev, [sentMessage]);
        messageCursorRef.current = getLastMessageId(merged);
        return merged;
      });
      showToast(markWorsening ? 'Worsening update sent to your care team.' : 'Message sent.', 'success');
    } catch {
      showToast('Could not send your message.');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  function handleSelectHistory(encounterId: number) {
    setSelectedEncounterId(encounterId);
    setSearchParams({ encounter: String(encounterId) }, { replace: true });
  }

  if (loadingEncounters) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading conversations…</p>
      </div>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <span style={styles.badge}>Messages</span>
        <h1 style={styles.title}>Care-team conversations</h1>
        <p style={styles.subtitle}>
          {activeEncounter
            ? 'Your active encounter message thread stays live here, with updates from staff and a direct reply box.'
            : 'When there is no active encounter, you can review the message history from previous visits.'}
        </p>
      </section>

      {encounters.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={styles.emptyTitle}>No conversations yet</h2>
          <p style={styles.emptyBody}>
            Start a visit when you need care, and your messages with the clinic team will appear here.
          </p>
          <button style={styles.primaryButton} onClick={() => navigate('/priage')}>
            Start New Visit
          </button>
        </section>
      ) : activeEncounter ? (
        <>
          <ThreadHeaderCard encounter={activeEncounter} onOpenVisit={() => navigate(`/encounters/${activeEncounter.id}/current`)} />
          <section style={styles.threadCard}>
            <div style={styles.threadMetaBar}>
              <div>
                <p style={styles.threadLabel}>Active Encounter</p>
                <h2 style={styles.threadTitle}>{activeEncounter.chiefComplaint || 'Visit in progress'}</h2>
              </div>
              <span style={{ ...styles.statusPill, color: ENCOUNTER_STATUS_META[activeEncounter.status].color, background: ENCOUNTER_STATUS_META[activeEncounter.status].bg, borderColor: ENCOUNTER_STATUS_META[activeEncounter.status].border }}>
                {ENCOUNTER_STATUS_META[activeEncounter.status].shortLabel}
              </span>
            </div>

            <MessageList messages={messages} loading={loadingMessages} bottomRef={bottomRef} emptyLabel="No messages yet. Send a note to your care team below." />

            <div style={styles.composer}>
              <textarea
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message to your care team..."
                style={styles.textarea}
                rows={4}
                disabled={sending}
              />
              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={markWorsening}
                  onChange={(event) => setMarkWorsening(event.target.checked)}
                />
                Flag this message as a worsening symptom update
              </label>
              <div style={styles.composerActions}>
                <button style={styles.secondaryButton} onClick={() => navigate(`/encounters/${activeEncounter.id}/current`)}>
                  Open Visit Details
                </button>
                <button style={styles.primaryButton} onClick={() => void handleSendMessage()} disabled={sending || !draftMessage.trim()}>
                  {sending ? 'Sending…' : 'Send Message'}
                </button>
              </div>
            </div>
          </section>
        </>
      ) : pastEncounters.length > 0 ? (
        <>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Previous Encounter Histories</h2>
            <div style={styles.selectorStack}>
              {pastEncounters.map((encounter) => {
                const selected = encounter.id === threadEncounter?.id;
                return (
                  <button
                    key={encounter.id}
                    type="button"
                    onClick={() => handleSelectHistory(encounter.id)}
                    style={{
                      ...styles.selectorCard,
                      ...(selected ? styles.selectorCardActive : null),
                    }}
                  >
                    <div style={styles.selectorTop}>
                      <strong style={styles.selectorTitle}>{encounter.chiefComplaint || 'Visit record'}</strong>
                      <span style={{ ...styles.statusPill, color: ENCOUNTER_STATUS_META[encounter.status].color, background: ENCOUNTER_STATUS_META[encounter.status].bg, borderColor: ENCOUNTER_STATUS_META[encounter.status].border }}>
                        {ENCOUNTER_STATUS_META[encounter.status].shortLabel}
                      </span>
                    </div>
                    <p style={styles.selectorMeta}>
                      {formatEncounterDate(encounter.createdAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={styles.threadCard}>
            <div style={styles.threadMetaBar}>
              <div>
                <p style={styles.threadLabel}>Message History</p>
                <h2 style={styles.threadTitle}>{threadEncounter?.chiefComplaint || 'Past encounter'}</h2>
              </div>
            </div>

            <MessageList messages={messages} loading={loadingMessages} bottomRef={bottomRef} emptyLabel="No staff or patient messages were recorded for this encounter." />
          </section>
        </>
      ) : (
        <section style={styles.emptyCard}>
          <h2 style={styles.emptyTitle}>No previous message history</h2>
          <p style={styles.emptyBody}>
            This account does not have any encounter message threads yet.
          </p>
        </section>
      )}
    </main>
  );
}

function ThreadHeaderCard({
  encounter,
  onOpenVisit,
}: {
  encounter: EncounterSummary;
  onOpenVisit: () => void;
}) {
  return (
    <section style={styles.section}>
      <article style={styles.summaryCard}>
        <div style={styles.summaryContent}>
          <p style={styles.summaryEyebrow}>Current encounter</p>
          <h2 style={styles.summaryTitle}>{encounter.chiefComplaint || 'Visit in progress'}</h2>
          <p style={styles.summaryText}>
            Opened {formatEncounterDate(encounter.createdAt)}. Messages and visit updates stay connected to this encounter while it is active.
          </p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={onOpenVisit}>
          View Visit
        </button>
      </article>
    </section>
  );
}

function MessageList({
  messages,
  loading,
  emptyLabel,
  bottomRef,
}: {
  messages: Message[];
  loading: boolean;
  emptyLabel: string;
  bottomRef: React.RefObject<HTMLDivElement>;
}) {
  if (loading) {
    return (
      <div style={styles.threadLoading}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading messages…</p>
      </div>
    );
  }

  return (
    <div style={styles.messageList}>
      {messages.length === 0 ? (
        <div style={styles.threadEmpty}>{emptyLabel}</div>
      ) : (
        messages.map((message) => {
          const sender = resolveSenderLabel(message.senderType);
          const isPatient = message.senderType === 'PATIENT';
          const isSystem = message.senderType === 'SYSTEM';

          return (
            <article
              key={message.id}
              style={{
                ...styles.messageBubble,
                ...(isPatient ? styles.messageBubblePatient : isSystem ? styles.messageBubbleSystem : styles.messageBubbleStaff),
              }}
            >
              <div style={styles.messageMeta}>
                <span style={styles.messageSender}>{sender}</span>
                <span style={styles.messageTimestamp}>{formatMessageTime(message.createdAt)}</span>
              </div>
              <p style={styles.messageBody}>{message.content}</p>
            </article>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function resolveSenderLabel(senderType: Message['senderType']): string {
  if (senderType === 'PATIENT') {
    return 'You';
  }
  if (senderType === 'SYSTEM') {
    return 'System';
  }
  return 'Care team';
}

function formatEncounterDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMessageTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: 'calc(100vh - 64px)',
    padding: '1rem 1rem 2rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
  },
  center: {
    minHeight: 'calc(100vh - 64px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
    alignItems: 'center',
    justifyContent: 'center',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
  },
  spinner: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '4px solid #dbe3f3',
    borderTopColor: patientTheme.colors.accent,
    animation: 'spin 0.9s linear infinite',
  },
  loadingText: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
  },
  hero: {
    maxWidth: '760px',
    margin: '0 auto 0.95rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.28rem 0.72rem',
    borderRadius: '999px',
    border: panelBorder,
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  title: {
    margin: '0.7rem 0 0',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.45rem',
  },
  subtitle: {
    margin: '0.3rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
    fontSize: '0.93rem',
  },
  section: {
    maxWidth: '760px',
    margin: '0 auto 1rem',
  },
  sectionTitle: {
    margin: '0 0 0.5rem',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '0.96rem',
    letterSpacing: '0.02em',
    color: patientTheme.colors.inkMuted,
    textTransform: 'uppercase',
  },
  summaryCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.panel,
    padding: '1rem',
    display: 'grid',
    gap: '0.8rem',
  },
  summaryContent: {
    display: 'grid',
    gap: '0.3rem',
  },
  summaryEyebrow: {
    margin: 0,
    fontSize: '0.76rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: patientTheme.colors.accentStrong,
  },
  summaryTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.08rem',
  },
  summaryText: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.5,
  },
  threadCard: {
    maxWidth: '760px',
    margin: '0 auto',
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.panel,
    overflow: 'hidden',
  },
  threadMetaBar: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    padding: '1rem 1rem 0.8rem',
    borderBottom: panelBorder,
  },
  threadLabel: {
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: patientTheme.colors.inkMuted,
  },
  threadTitle: {
    margin: '0.25rem 0 0',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.08rem',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid',
    borderRadius: '999px',
    padding: '0.22rem 0.58rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  messageList: {
    minHeight: '280px',
    maxHeight: '56vh',
    overflowY: 'auto',
    display: 'grid',
    gap: '0.75rem',
    padding: '1rem',
    background: 'linear-gradient(180deg, rgba(250, 251, 255, 0.92) 0%, rgba(255, 253, 248, 1) 100%)',
  },
  threadLoading: {
    minHeight: '280px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.8rem',
  },
  threadEmpty: {
    margin: 'auto',
    maxWidth: '420px',
    textAlign: 'center',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.5,
  },
  messageBubble: {
    maxWidth: '88%',
    borderRadius: '18px',
    padding: '0.8rem 0.9rem',
    display: 'grid',
    gap: '0.35rem',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
  },
  messageBubblePatient: {
    justifySelf: 'end',
    background: 'linear-gradient(135deg, #1949b8 0%, #3b82f6 100%)',
    color: '#fff',
  },
  messageBubbleStaff: {
    justifySelf: 'start',
    background: '#ffffff',
    color: patientTheme.colors.ink,
    border: panelBorder,
  },
  messageBubbleSystem: {
    justifySelf: 'center',
    background: '#fff7e9',
    color: '#8a4b07',
    border: '1px solid #fed7aa',
  },
  messageMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    fontSize: '0.74rem',
    opacity: 0.86,
  },
  messageSender: {
    fontWeight: 700,
  },
  messageTimestamp: {
    whiteSpace: 'nowrap',
  },
  messageBody: {
    margin: 0,
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
  },
  composer: {
    display: 'grid',
    gap: '0.75rem',
    padding: '1rem',
    borderTop: panelBorder,
    background: '#fff',
  },
  textarea: {
    width: '100%',
    resize: 'vertical',
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    padding: '0.85rem 0.9rem',
    fontFamily: patientTheme.fonts.body,
    fontSize: '0.95rem',
    color: patientTheme.colors.ink,
    boxSizing: 'border-box',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    fontSize: '0.85rem',
    color: patientTheme.colors.inkMuted,
  },
  composerActions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '0.65rem',
  },
  selectorStack: {
    display: 'grid',
    gap: '0.55rem',
  },
  selectorCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.card,
    padding: '0.85rem 0.9rem',
    display: 'grid',
    gap: '0.4rem',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: patientTheme.fonts.body,
  },
  selectorCardActive: {
    border: '1px solid rgba(59, 130, 246, 0.35)',
    background: '#eef5ff',
  },
  selectorTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.65rem',
  },
  selectorTitle: {
    fontSize: '0.93rem',
  },
  selectorMeta: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.82rem',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.78rem 1rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.78rem 1rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  emptyCard: {
    maxWidth: '640px',
    margin: '0.4rem auto 0',
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.panel,
    padding: '1.3rem',
    textAlign: 'center',
  },
  emptyTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.08rem',
  },
  emptyBody: {
    margin: '0.45rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.5,
  },
};
