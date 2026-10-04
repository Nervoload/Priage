import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { listMyEncounters, listMyMessages } from '../shared/api/encounters';
import { encounterStatusMeta, isActiveEncounter } from '../shared/encounters';
import { useAuth } from '../shared/hooks/useAuth';
import { useGuestSession } from '../shared/hooks/useGuestSession';
import { appendUniqueMessages, chooseMessageEncounter, getLastMessageId } from '../shared/messages';
import {
  flushPatientMessageOutbox,
  isOutboxQueuedError,
  sendPatientMessageReliable,
} from '../shared/patientOutbox';
import type { EncounterSummary, Message } from '../shared/types/domain';
import { CtaLink, LoadingScreen, Spinner, StatusPill } from '../shared/ui/Controls';
import { cx } from '../shared/ui/cx';
import { Icon } from '../shared/ui/Icon';
import { useToast } from '../shared/ui/ToastContext';

const ACTIVE_THREAD_POLL_MS = 30_000;

export function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session: authSession } = useAuth();
  const { session: guestSession } = useGuestSession();
  const { showToast } = useToast();
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingEncounters, setLoadingEncounters] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [markWorsening, setMarkWorsening] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messageCursorRef = useRef<number | null>(null);
  const currentThreadIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEncounters() {
      try {
        const data = await listMyEncounters();
        if (!cancelled) {
          setEncounters(authSession ? data : data.filter((encounter) => encounter.id === guestSession?.encounterId));
        }
      } catch {
        if (!cancelled) {
          showToast('We couldn’t load your conversations. Please try again shortly.');
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
  }, [authSession, guestSession?.encounterId, showToast]);

  const requestedId = Number(searchParams.get('encounter'));
  const threadEncounter = useMemo(
    () => chooseMessageEncounter(encounters, Number.isInteger(requestedId) && requestedId > 0 ? requestedId : null),
    [encounters, requestedId],
  );
  const threadEncounterId = threadEncounter?.id ?? null;
  const canReply = !!threadEncounter && isActiveEncounter(threadEncounter.status);
  currentThreadIdRef.current = threadEncounterId;

  useEffect(() => {
    messageCursorRef.current = null;
    setMessages([]);
    setLoadingMessages(false);
    setSendError(null);
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

      if (currentThreadIdRef.current !== encounterId) return;

      if (mode === 'replace') {
        setMessages((prev) => {
          const merged = appendUniqueMessages(next, prev);
          messageCursorRef.current = getLastMessageId(merged);
          return merged;
        });
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
        showToast('We couldn’t load these messages. Please try again shortly.');
      }
    } finally {
      if (mode === 'replace' && currentThreadIdRef.current === encounterId) {
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
    const interval = canReply
      ? window.setInterval(() => void loadThreadMessages(encounterId, 'append'), ACTIVE_THREAD_POLL_MS)
      : null;

    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [canReply, loadThreadMessages, threadEncounterId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSendMessage() {
    if (!threadEncounter || !canReply) {
      return;
    }

    const trimmed = draftMessage.trim();
    if (!trimmed || sending) {
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      const sentMessage = await sendPatientMessageReliable(threadEncounter.id, trimmed, markWorsening);
      if (currentThreadIdRef.current === threadEncounter.id) {
        setDraftMessage('');
        setMarkWorsening(false);
        resetComposerHeight();
        setMessages((prev) => {
          const merged = appendUniqueMessages(prev, [sentMessage]);
          messageCursorRef.current = getLastMessageId(merged);
          return merged;
        });
      }
      if (markWorsening) {
        showToast('We’ve flagged this update for your care team.', 'success');
      }
    } catch (error) {
      if (isOutboxQueuedError(error)) {
        if (currentThreadIdRef.current === threadEncounter.id) {
          setDraftMessage('');
          setMarkWorsening(false);
        }
        showToast('You’re offline. We’ll send your message when you reconnect.', 'info');
      } else {
        if (currentThreadIdRef.current === threadEncounter.id) {
          setSendError('Your message didn’t send. Your draft is still here — please try again.');
        }
      }
    } finally {
      setSending(false);
    }
  }

  function resetComposerHeight() {
    if (composerRef.current) {
      composerRef.current.style.height = '';
    }
  }

  function handleDraftChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraftMessage(event.target.value);
    setSendError(null);
    const element = event.target;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  function handleSelectHistory(encounterId: number) {
    setSearchParams({ encounter: String(encounterId) }, { replace: true });
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void flushPatientMessageOutbox((sentMessage, encounterId) => {
        if (encounterId !== threadEncounterId) {
          return;
        }
        setMessages((prev) => {
          const merged = appendUniqueMessages(prev, [sentMessage]);
          messageCursorRef.current = getLastMessageId(merged);
          return merged;
        });
      });
    }, 15_000);

    void flushPatientMessageOutbox();
    return () => window.clearInterval(timer);
  }, [threadEncounterId]);

  if (loadingEncounters) {
    return <LoadingScreen label="Loading conversations…" />;
  }

  const hasMany = encounters.length > 1;

  return (
    <main id="main" className="page" style={{ maxWidth: hasMany ? 1040 : undefined }}>
      <header className="page__header">
        <h1 className="display">Messages</h1>
        <p className="lede">
          {canReply ? 'Talk with your care team about this visit. They reply during their working hours.' : 'Your conversations with care teams.'}
        </p>
      </header>

      {encounters.length === 0 ? (
        <section className="card empty">
          <span className="tile__icon"><Icon name="message" /></span>
          <div className="stack stack--xs">
            <h2 className="title">No conversations yet</h2>
            <p className="body">When you start a visit, you can message the care team here.</p>
          </div>
          {authSession && <div style={{ width: '100%', maxWidth: 360 }}><CtaLink to="/priage">Start a visit</CtaLink></div>}
        </section>
      ) : threadEncounter ? (
        <div className={cx(hasMany && 'split')}>
          {hasMany && <ConversationList encounters={encounters} selectedId={threadEncounter.id} onSelect={handleSelectHistory} />}

          <section className="card thread-card" aria-label="Conversation">
            <div className="card__head">
              <span className="row__main">
                <span className="heading">{threadEncounter.chiefComplaint || 'Your visit'}</span>
                <span className="small">Started {formatEncounterDate(threadEncounter.createdAt)}</span>
              </span>
              <Link to={`/encounters/${threadEncounter.id}/current`} className="text-btn" style={{ minHeight: 0 }}>View visit</Link>
            </div>

            <MessageList
              messages={messages}
              loading={loadingMessages}
              bottomRef={bottomRef}
              emptyLabel={canReply ? 'No messages yet. Write to your care team below.' : 'No messages were sent during this visit.'}
            />

            {canReply ? (
              <div className="composer">
                {sendError && (
                  <p className="field__error" role="alert">
                    <Icon name="alertCircle" size={16} />
                    {sendError}
                  </p>
                )}
                <div className="composer__row">
                  <label htmlFor="message-composer" className="sr-only">Message your care team</label>
                  <textarea
                    id="message-composer"
                    ref={composerRef}
                    className="composer__input"
                    value={draftMessage}
                    onChange={handleDraftChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a message"
                    rows={1}
                    disabled={sending}
                  />
                  <button type="button" className="send-btn" aria-label="Send message" onClick={() => void handleSendMessage()} disabled={sending || !draftMessage.trim()}>
                    {sending ? <Spinner small /> : <Icon name="arrowUp" />}
                  </button>
                </div>
                <div className="cluster" style={{ justifyContent: 'space-between' }}>
                  <label className="toggle-chip">
                    <input type="checkbox" checked={markWorsening} onChange={(event) => setMarkWorsening(event.target.checked)} />
                    <Icon name="flag" size={15} />
                    My symptoms are getting worse
                  </label>
                  <span className="small">Not for emergencies — call 911.</span>
                </div>
              </div>
            ) : (
              <p className="composer small" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="lock" size={16} />
                This visit has ended, so replies are closed.
              </p>
            )}
          </section>
        </div>
      ) : (
        <section className="card empty">
          <h2 className="title">No message history</h2>
          <p className="body">Your account doesn’t have any conversations yet.</p>
        </section>
      )}
    </main>
  );
}

function ConversationList({
  encounters,
  selectedId,
  onSelect,
}: {
  encounters: EncounterSummary[];
  selectedId: number;
  onSelect: (encounterId: number) => void;
}) {
  return (
    <nav className="card conversation-list" aria-label="Conversations">
      <div className="rows">
        {encounters.map((encounter) => {
          const meta = encounterStatusMeta(encounter.status);
          const active = isActiveEncounter(encounter.status);
          return (
            <button
              key={encounter.id}
              type="button"
              className="row row--link"
              aria-current={encounter.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(encounter.id)}
            >
              <span className="row__main">
                <span className="row__value" style={{ fontWeight: encounter.id === selectedId ? 600 : 400 }}>{encounter.chiefComplaint || 'Visit'}</span>
                <span className="small">{formatEncounterDate(encounter.createdAt)}</span>
              </span>
              {active && <StatusPill tone={meta.tone} dot={meta.dot}>Active</StatusPill>}
            </button>
          );
        })}
      </div>
    </nav>
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
      <div className="thread" style={{ alignItems: 'center', justifyContent: 'center' }} role="status">
        <Spinner />
        <span className="small">Loading messages…</span>
      </div>
    );
  }

  return (
    <div className="thread" aria-live="polite">
      {messages.length === 0 ? (
        <p className="event-chip">{emptyLabel}</p>
      ) : (
        messages.map((message, index) => {
          const previous = messages[index - 1];
          const showDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
          return (
            <Fragment key={message.id}>
              {showDay && <span className="day-label">{formatDayLabel(message.createdAt)}</span>}
              {message.senderType === 'SYSTEM' ? (
                <p className="event-chip">{message.content}</p>
              ) : (
                <div className={cx('bubble-group', message.senderType === 'PATIENT' && 'bubble-group--me')}>
                  <div className="bubble">{message.content}</div>
                  <span className="bubble__meta">
                    {message.senderType === 'PATIENT' ? formatMessageTime(message.createdAt) : `Care team, ${formatMessageTime(message.createdAt)}`}
                  </span>
                </div>
              )}
            </Fragment>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function dayKey(value: string): string {
  return new Date(value).toDateString();
}

function formatDayLabel(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatEncounterDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMessageTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
