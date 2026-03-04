// Per-encounter chat view.
// Polls for messages every 5 seconds, sends patient messages.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getMyEncounter,
  listMyMessages,
  sendPatientMessage,
} from '../shared/api/encounters';
import { useToast } from '../shared/ui/ToastContext';
import type { Encounter, Message } from '../shared/types/domain';

const POLL_INTERVAL = 5_000;

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const encounterId = id ? Number(id) : 0;

  // Load encounter details
  useEffect(() => {
    if (!encounterId) return;
    (async () => {
      try {
        const enc = await getMyEncounter(encounterId);
        setEncounter(enc);
      } catch {
        showToast('Could not load encounter');
        navigate('/messages');
      } finally {
        setLoading(false);
      }
    })();
  }, [encounterId]);

  // Poll messages
  const fetchMessages = useCallback(async () => {
    if (!encounterId) return;
    try {
      const msgs = await listMyMessages(encounterId);
      setMessages(msgs);
    } catch {
      // silent — will retry next interval
    }
  }, [encounterId]);

  useEffect(() => {
    fetchMessages();
    const timer = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !encounterId) return;
    setInput('');
    setSending(true);
    try {
      await sendPatientMessage(encounterId, text);
      // Immediately fetch to show the new message
      await fetchMessages();
    } catch {
      showToast('Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function handleWorsening() {
    if (!encounterId || sending) return;
    setSending(true);
    try {
      await sendPatientMessage(
        encounterId,
        '⚠️ ALERT: My condition is getting worse. Please check on me urgently.',
      );
      await fetchMessages();
      showToast('Worsening alert sent to care team', 'success');
    } catch {
      showToast('Failed to send alert');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(d: string) {
    return new Date(d).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={styles.loadingText}>Loading…</p>
      </div>
    );
  }

  const isTerminal = encounter && ['DISCHARGED', 'CANCELLED', 'LEFT_AMA'].includes(encounter.status);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/messages')}>
          ‹
        </button>
        <div style={styles.headerInfo}>
          <p style={styles.headerTitle}>
            {encounter?.chiefComplaint || 'Visit Chat'}
          </p>
          <p style={styles.headerStatus}>
            {encounter?.status?.replace(/_/g, ' ') ?? ''}
          </p>
        </div>
        {!isTerminal && (
          <button style={styles.alertBtn} onClick={handleWorsening}>
            ⚠️
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={styles.chatArea}>
        {messages.length === 0 && (
          <p style={styles.emptyMsg}>
            No messages yet. Send a message to your care team.
          </p>
        )}

        {messages.map(msg => {
          const isPatient = msg.senderType === 'PATIENT';
          return (
            <div
              key={msg.id}
              style={{
                ...styles.msgRow,
                justifyContent: isPatient ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  ...styles.bubble,
                  ...(isPatient ? styles.patientBubble : styles.staffBubble),
                }}
              >
                {!isPatient && (
                  <p style={styles.senderLabel}>Care Team</p>
                )}
                <p style={styles.bubbleText}>{msg.content}</p>
                <p style={styles.timestamp}>{formatTime(msg.createdAt)}</p>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isTerminal ? (
        <div style={styles.closedBanner}>
          <p style={styles.closedText}>This visit has ended.</p>
        </div>
      ) : (
        <div style={styles.inputBar}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            style={styles.input}
            disabled={sending}
          />
          <button
            style={styles.sendBtn}
            onClick={handleSend}
            disabled={!input.trim() || sending}
          >
            ↑
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 64px)',
    maxWidth: '500px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - 64px)',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: '0.9rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1rem',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.6rem',
    color: '#1e3a5f',
    cursor: 'pointer',
    padding: '0 0.25rem',
    lineHeight: 1,
    fontWeight: 700,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  headerStatus: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
    margin: 0,
  },
  alertBtn: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '0.35rem 0.5rem',
    fontSize: '1rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  emptyMsg: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '0.85rem',
    padding: '2rem 0',
  },
  msgRow: {
    display: 'flex',
  },
  bubble: {
    maxWidth: '80%',
    padding: '0.6rem 0.85rem',
    borderRadius: '16px',
  },
  patientBubble: {
    background: '#1e3a5f',
    color: '#fff',
    borderBottomRightRadius: '4px',
  },
  staffBubble: {
    background: '#f1f5f9',
    color: '#0f172a',
    borderBottomLeftRadius: '4px',
  },
  senderLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#64748b',
    margin: '0 0 0.15rem',
  },
  bubbleText: {
    margin: 0,
    fontSize: '0.9rem',
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
  },
  timestamp: {
    fontSize: '0.65rem',
    opacity: 0.65,
    marginTop: '0.2rem',
    textAlign: 'right',
  },
  closedBanner: {
    padding: '0.75rem',
    background: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
    textAlign: 'center',
  },
  closedText: {
    color: '#94a3b8',
    fontSize: '0.85rem',
    margin: 0,
  },
  inputBar: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: '#fff',
    borderTop: '1px solid #e2e8f0',
  },
  input: {
    flex: 1,
    padding: '0.65rem 0.85rem',
    border: '2px solid #e2e8f0',
    borderRadius: '20px',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  sendBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    background: '#1e3a5f',
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};
