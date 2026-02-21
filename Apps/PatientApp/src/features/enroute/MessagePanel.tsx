// PatientApp/src/features/enroute/MessagePanel.tsx
// Patient-side chat panel — messages between patient and ER staff.

import { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../../shared/types/domain';
import { messageToChatMessage } from '../../shared/types/domain';
import { listMyMessages } from '../../shared/api/encounters';
import { parseSMSCommand, routeSMSCommand } from '../../app/SMSInterface';
import { useToast } from '../../shared/ui/ToastContext';

interface MessagePanelProps {
  encounterId: number;
}

export function MessagePanel({ encounterId }: MessagePanelProps) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // Fetch messages on mount + poll every 5s
  useEffect(() => {
    let cancelled = false;

    async function fetchMessages() {
      try {
        const msgs = await listMyMessages(encounterId);
        if (!cancelled) {
          setMessages(msgs.map(messageToChatMessage));
        }
      } catch {
        // Silently fail — will retry on next poll
      }
    }

    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 5000);

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [encounterId]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const raw = input.trim();
    if (!raw || sending) return;

    setSending(true);
    setInput('');

    try {
      const cmd = parseSMSCommand(raw);

      if (cmd.type === 'message' || cmd.type === 'worsening') {
        const result = await routeSMSCommand(encounterId, cmd);
        if (result.response) {
          showToast(result.response, 'info');
        }
        // Optimistically add the message
        setMessages(prev => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            sender: 'patient',
            text: cmd.type === 'worsening' ? cmd.content : raw,
            timestamp: new Date().toISOString(),
          },
        ]);
      } else if (cmd.type === 'checkin') {
        showToast('Check-in noted. A nurse will be with you shortly.', 'info');
      } else {
        showToast('Message not recognized.', 'info');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send message.');
      setInput(raw); // Restore the input on error
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>💬</span>
        <span style={styles.headerTitle}>Messages with ER Staff</span>
      </div>

      <div style={styles.messageList}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            No messages yet. Send a message to your care team below.
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              ...styles.bubble,
              ...(msg.sender === 'patient' ? styles.bubblePatient : styles.bubbleStaff),
            }}
          >
            <div style={styles.bubbleSender}>
              {msg.sender === 'patient' ? 'You' : 'ER Staff'}
            </div>
            <div style={styles.bubbleText}>{msg.text}</div>
            <div style={styles.bubbleTime}>
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputRow}>
        <input
          style={styles.textInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={sending}
        />
        <button
          style={{
            ...styles.sendBtn,
            opacity: sending || !input.trim() ? 0.5 : 1,
          }}
          onClick={handleSend}
          disabled={sending || !input.trim()}
        >
          Send
        </button>
      </div>

      <p style={styles.hint}>
        Type <strong>!worse</strong> before your message to alert staff about worsening symptoms.
      </p>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  headerIcon: { fontSize: '1.1rem' },
  headerTitle: { fontWeight: 600, fontSize: '0.9rem', color: '#334155' },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '0.85rem',
    padding: '2rem 0',
  },
  bubble: {
    maxWidth: '80%',
    padding: '0.6rem 0.85rem',
    borderRadius: '14px',
    fontSize: '0.9rem',
    lineHeight: 1.4,
  },
  bubblePatient: {
    alignSelf: 'flex-end',
    background: '#1e3a5f',
    color: '#fff',
    borderBottomRightRadius: '4px',
  },
  bubbleStaff: {
    alignSelf: 'flex-start',
    background: '#f1f5f9',
    color: '#0f172a',
    borderBottomLeftRadius: '4px',
  },
  bubbleSender: {
    fontSize: '0.7rem',
    fontWeight: 600,
    opacity: 0.7,
    marginBottom: '2px',
  },
  bubbleText: {},
  bubbleTime: {
    fontSize: '0.65rem',
    opacity: 0.6,
    marginTop: '4px',
    textAlign: 'right',
  },
  inputRow: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderTop: '1px solid #e2e8f0',
    background: '#fff',
  },
  textInput: {
    flex: 1,
    padding: '0.6rem 0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  sendBtn: {
    padding: '0.6rem 1.25rem',
    background: '#1e3a5f',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    textAlign: 'center',
    padding: '0.25rem 1rem 0.75rem',
    margin: 0,
  },
};
