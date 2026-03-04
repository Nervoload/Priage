// Priage AI chatbot page.
// Conversational symptom assessment → hospital admission flow.

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { priageChat, priageAdmit, listHospitals } from '../shared/api/priage';
import { useToast } from '../shared/ui/ToastContext';
import type { PriageChatMessage, PriageAssessment, Hospital } from '../shared/types/domain';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  assessment?: PriageAssessment;
  canAdmit?: boolean;
}

export function PriagePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showAdmit, setShowAdmit] = useState(false);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [admitting, setAdmitting] = useState(false);
  const [latestAssessment, setLatestAssessment] = useState<PriageAssessment | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initial greeting from AI on mount
  useEffect(() => {
    async function initChat() {
      try {
        const response = await priageChat([]);
        setMessages([{
          id: 'init',
          role: 'assistant',
          content: response.reply,
          assessment: response.assessment,
          canAdmit: response.canAdmit,
        }]);
      } catch {
        setMessages([{
          id: 'init',
          role: 'assistant',
          content: "Hello! I'm Priage, your AI health assistant. What symptoms are you experiencing today?",
          canAdmit: false,
        }]);
      }
    }
    initChat();
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);

    // Add user message
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMsg]);

    // Build conversation history for API
    const apiMessages: PriageChatMessage[] = [
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text },
    ];

    try {
      const response = await priageChat(apiMessages);

      const assistantMsg: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        assessment: response.assessment,
        canAdmit: response.canAdmit,
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (response.assessment) {
        setLatestAssessment(response.assessment);
      }
      if (response.canAdmit) {
        setShowAdmit(true);
        // Pre-fetch hospitals
        try {
          const h = await listHospitals();
          setHospitals(h);
          if (h.length > 0) setSelectedHospital(h[0].slug);
        } catch {
          // silent
        }
      }
    } catch (err) {
      showToast('Failed to get AI response. Please try again.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleAdmit() {
    if (!latestAssessment || admitting) return;

    // Gather chief complaint from first user message
    const firstUserMsg = messages.find(m => m.role === 'user');
    const chiefComplaint = firstUserMsg?.content ?? 'Symptoms reported via Priage AI';

    // Build details from all user messages
    const allUserText = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');

    setAdmitting(true);
    try {
      const result = await priageAdmit({
        chiefComplaint,
        details: `AI Assessment: ${latestAssessment.summary}\n\nPatient reported:\n${allUserText}`,
        hospitalSlug: selectedHospital || undefined,
        severity: latestAssessment.urgency === 'emergency' ? 10
          : latestAssessment.urgency === 'high' ? 7
          : latestAssessment.urgency === 'medium' ? 5
          : 3,
      });

      showToast(result.message, 'success');

      // Navigate to the new encounter's chat
      setTimeout(() => {
        navigate(`/messages/${result.encounter.id}`);
      }, 1500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to check in. Please try again.');
    } finally {
      setAdmitting(false);
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
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.headerTitle}>🩺 Priage AI</h2>
        <p style={styles.headerSubtitle}>Symptom Assessment</p>
      </div>

      {/* Messages */}
      <div style={styles.chatArea}>
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              ...styles.msgRow,
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                ...styles.bubble,
                ...(msg.role === 'user' ? styles.userBubble : styles.aiBubble),
              }}
            >
              <p style={styles.bubbleText}>{msg.content}</p>

              {/* Assessment card */}
              {msg.assessment && (
                <div style={styles.assessmentCard}>
                  <UrgencyBadge urgency={msg.assessment.urgency} />
                  <p style={styles.assessmentAction}>{msg.assessment.suggestedAction}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }}>
            <div style={{ ...styles.bubble, ...styles.aiBubble }}>
              <p style={styles.typingIndicator}>Priage is thinking…</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Admit panel */}
      {showAdmit && latestAssessment && (
        <div style={styles.admitPanel}>
          <p style={styles.admitTitle}>Ready to check in?</p>
          {hospitals.length > 0 && (
            <select
              value={selectedHospital}
              onChange={e => setSelectedHospital(e.target.value)}
              style={styles.hospitalSelect}
            >
              {hospitals.map(h => (
                <option key={h.slug} value={h.slug}>{h.name}</option>
              ))}
            </select>
          )}
          <button
            style={styles.admitBtn}
            onClick={handleAdmit}
            disabled={admitting}
          >
            {admitting ? 'Checking in…' : '🏥 Check In to Hospital'}
          </button>
        </div>
      )}

      {/* Input */}
      <div style={styles.inputBar}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your symptoms…"
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
    </div>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    emergency: { bg: '#fef2f2', color: '#dc2626', label: '⚠️ Emergency' },
    high:      { bg: '#fff7ed', color: '#ea580c', label: 'High Urgency' },
    medium:    { bg: '#fffbeb', color: '#d97706', label: 'Moderate' },
    low:       { bg: '#f0fdf4', color: '#16a34a', label: 'Low Urgency' },
  };
  const c = config[urgency] ?? config.low;

  return (
    <span style={{ ...styles.urgencyBadge, background: c.bg, color: c.color }}>
      {c.label}
    </span>
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
  header: {
    padding: '0.75rem 1rem',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#1e3a5f',
    margin: 0,
  },
  headerSubtitle: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    margin: '0.1rem 0 0',
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  msgRow: {
    display: 'flex',
  },
  bubble: {
    maxWidth: '85%',
    padding: '0.75rem 1rem',
    borderRadius: '16px',
  },
  userBubble: {
    background: '#1e3a5f',
    color: '#fff',
    borderBottomRightRadius: '4px',
  },
  aiBubble: {
    background: '#f1f5f9',
    color: '#0f172a',
    borderBottomLeftRadius: '4px',
  },
  bubbleText: {
    margin: 0,
    fontSize: '0.9rem',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  typingIndicator: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  assessmentCard: {
    marginTop: '0.75rem',
    padding: '0.5rem 0.75rem',
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
  },
  urgencyBadge: {
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  assessmentAction: {
    fontSize: '0.8rem',
    color: '#475569',
    margin: '0.35rem 0 0',
  },
  admitPanel: {
    padding: '0.75rem 1rem',
    background: '#f0fdf4',
    borderTop: '1px solid #bbf7d0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  admitTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#166534',
    margin: 0,
  },
  hospitalSelect: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    fontSize: '0.85rem',
    background: '#fff',
    fontFamily: 'inherit',
  },
  admitBtn: {
    padding: '0.7rem',
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
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
