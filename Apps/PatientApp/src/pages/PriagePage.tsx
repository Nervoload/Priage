import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { listHospitals, priageAdmit, priageChat } from '../shared/api/priage';
import { useDemo } from '../shared/demo';
import type {
  Hospital,
  PriageAssessment,
  PriageChatMessage,
} from '../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  assessment?: PriageAssessment;
  canAdmit?: boolean;
}

const defaultQuickPrompts = [
  'I have had worsening chest pain for about one hour.',
  'My migraine includes nausea and flashing lights.',
  'I cut my arm and the bleeding restarted.',
];

export function PriagePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { selectedScenario, scenarios, setSelectedScenarioId } = useDemo();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showAdmit, setShowAdmit] = useState(false);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [admitting, setAdmitting] = useState(false);
  const [latestAssessment, setLatestAssessment] = useState<PriageAssessment | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function initChat() {
      try {
        const response = await priageChat([]);
        if (cancelled) return;
        setMessages([{
          id: 'init',
          role: 'assistant',
          content: response.reply,
          assessment: response.assessment,
          canAdmit: response.canAdmit,
        }]);
        if (response.assessment) {
          setLatestAssessment(response.assessment);
        }
        if (response.canAdmit) {
          setShowAdmit(true);
        }
      } catch {
        if (cancelled) return;
        setMessages([{
          id: 'init',
          role: 'assistant',
          content: "Hi, I'm Priage. Tell me what symptoms you're dealing with right now.",
          canAdmit: false,
        }]);
      }
    }

    void initChat();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, showAdmit]);

  useEffect(() => {
    let cancelled = false;
    async function loadHospitals() {
      try {
        const result = await listHospitals();
        if (cancelled) return;
        setHospitals(result);
      } catch {
        if (!cancelled) {
          setHospitals([]);
        }
      }
    }
    void loadHospitals();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hospitals.length) return;
    if (selectedHospital) return;
    const scenarioHospital = hospitals.find((hospital) => hospital.slug === selectedScenario.hospitalSlug);
    setSelectedHospital(scenarioHospital?.slug ?? hospitals[0].slug);
  }, [hospitals, selectedHospital, selectedScenario.hospitalSlug]);

  const quickPrompts = useMemo(() => {
    const prompts = [...defaultQuickPrompts];
    if (selectedScenario.priageStarterPrompt && !prompts.includes(selectedScenario.priageStarterPrompt)) {
      prompts.unshift(selectedScenario.priageStarterPrompt);
    }
    return prompts.slice(0, 4);
  }, [selectedScenario.priageStarterPrompt]);

  async function handleSendMessage(messageText: string) {
    const content = messageText.trim();
    if (!content || sending) return;

    setSending(true);
    if (messageText === input) {
      setInput('');
    }

    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };
    setMessages((previous) => [...previous, userMessage]);

    const apiMessages: PriageChatMessage[] = [
      ...messages.map((message) => ({ role: message.role, content: message.content })),
      { role: 'user', content },
    ];

    try {
      const response = await priageChat(apiMessages);
      const assistantMessage: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        assessment: response.assessment,
        canAdmit: response.canAdmit,
      };
      setMessages((previous) => [...previous, assistantMessage]);
      if (response.assessment) {
        setLatestAssessment(response.assessment);
      }
      if (response.canAdmit) {
        setShowAdmit(true);
      }
    } catch {
      showToast('Failed to get AI response. Please try again.');
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  async function handleAdmit() {
    if (!latestAssessment || admitting) return;

    const firstUserMessage = messages.find((message) => message.role === 'user');
    const chiefComplaint = firstUserMessage?.content ?? 'Symptoms reported via Priage AI';
    const detailTranscript = messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n');

    setAdmitting(true);
    try {
      const response = await priageAdmit({
        chiefComplaint,
        details: `AI Summary: ${latestAssessment.summary}\n\nPatient statements:\n${detailTranscript}`,
        hospitalSlug: selectedHospital || undefined,
        severity: latestAssessment.urgency === 'emergency'
          ? 10
          : latestAssessment.urgency === 'high'
            ? 7
            : latestAssessment.urgency === 'medium'
              ? 5
              : 3,
      });
      showToast(response.message, 'success');
      navigate(`/encounters/${response.encounter.id}/current`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not start hospital visit.');
    } finally {
      setAdmitting(false);
    }
  }

  function applyScenarioStarter() {
    setInput(selectedScenario.priageStarterPrompt ?? quickPrompts[0]);
  }

  return (
    <main style={styles.page}>
      <section style={styles.layout}>
        <header style={styles.header}>
          <span style={styles.badge}>Priage AI</span>
          <h1 style={styles.title}>Start a new visit with guided triage</h1>
          <p style={styles.subtitle}>
            Current scenario: <strong>{selectedScenario.label}</strong>
          </p>
        </header>

        <section style={styles.sidePanel}>
          <h2 style={styles.sideTitle}>Scenario shortcuts</h2>
          <div style={styles.scenarioStack}>
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                style={{
                  ...styles.scenarioButton,
                  borderColor: scenario.id === selectedScenario.id ? patientTheme.colors.accent : patientTheme.colors.line,
                }}
                onClick={() => setSelectedScenarioId(scenario.id)}
              >
                <strong>{scenario.label}</strong>
                <span>{scenario.persona === 'guest' ? 'Guest' : 'Signed-in'} demo</span>
              </button>
            ))}
          </div>
          <button style={styles.secondaryButton} onClick={applyScenarioStarter}>
            Use scenario starter prompt
          </button>
        </section>

        <section style={styles.chatPanel}>
          <div style={styles.quickPrompts}>
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                style={styles.quickPromptChip}
                onClick={() => {
                  void handleSendMessage(prompt);
                }}
                disabled={sending}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div style={styles.chatScroll}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  ...styles.bubble,
                  ...(message.role === 'user' ? styles.userBubble : styles.aiBubble),
                }}
              >
                <p style={styles.bubbleText}>{message.content}</p>
                {message.assessment && (
                  <div style={styles.assessmentCard}>
                    <UrgencyBadge urgency={message.assessment.urgency} />
                    <small style={styles.assessmentText}>{message.assessment.suggestedAction}</small>
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div style={{ ...styles.bubble, ...styles.aiBubble }}>
                <p style={styles.typingText}>Priage is reviewing your symptoms…</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {showAdmit && latestAssessment && (
            <aside style={styles.admitPanel}>
              <h3 style={styles.admitTitle}>Ready to notify the hospital?</h3>
              <p style={styles.admitBody}>This creates a real encounter and sends your assessment summary.</p>
              {hospitals.length > 0 && (
                <select
                  style={styles.select}
                  value={selectedHospital}
                  onChange={(event) => setSelectedHospital(event.target.value)}
                >
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.slug}>
                      {hospital.name}
                    </option>
                  ))}
                </select>
              )}
              <button style={styles.primaryButton} onClick={handleAdmit} disabled={admitting}>
                {admitting ? 'Creating encounter…' : 'Create hospital encounter'}
              </button>
            </aside>
          )}

          <div style={styles.inputRow}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendMessage(input);
                }
              }}
              style={styles.input}
              placeholder="Describe symptoms, severity, and timing…"
              disabled={sending}
            />
            <button
              style={styles.primaryButton}
              onClick={() => {
                void handleSendMessage(input);
              }}
              disabled={!input.trim() || sending}
            >
              Send
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    emergency: { label: 'Emergency', color: '#9f1239', bg: '#ffe4e6' },
    high: { label: 'High', color: '#b45309', bg: '#fff7ed' },
    medium: { label: 'Moderate', color: '#854d0e', bg: '#fefce8' },
    low: { label: 'Low', color: '#166534', bg: '#f0fdf4' },
  };
  const meta = map[urgency] ?? map.low;
  return (
    <span style={{ ...styles.urgencyBadge, color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: 'calc(100vh - 64px)',
    padding: '1rem 1rem 5.5rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
  },
  layout: {
    maxWidth: '980px',
    margin: '0 auto',
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: '1fr',
    alignItems: 'start',
  },
  header: {
    gridColumn: '1 / -1',
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.card,
    padding: '0.82rem',
    display: 'grid',
    gap: '0.3rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    border: panelBorder,
    borderRadius: '999px',
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.26rem 0.72rem',
    fontSize: '0.74rem',
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.3rem',
  },
  subtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.9rem',
  },
  sidePanel: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.card,
    padding: '0.75rem',
    display: 'grid',
    gap: '0.48rem',
  },
  sideTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '0.95rem',
  },
  scenarioStack: {
    display: 'grid',
    gap: '0.42rem',
  },
  scenarioButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    padding: '0.55rem 0.62rem',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.12rem',
    fontFamily: patientTheme.fonts.body,
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.62rem 0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  chatPanel: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.card,
    padding: '0.75rem',
    display: 'grid',
    gap: '0.55rem',
    minHeight: '520px',
  },
  quickPrompts: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.42rem',
  },
  quickPromptChip: {
    border: '1px solid #b8d0ff',
    borderRadius: '999px',
    background: '#eef5ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.3rem 0.62rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  chatScroll: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    minHeight: '280px',
    maxHeight: '380px',
    overflowY: 'auto',
    padding: '0.65rem',
    display: 'grid',
    gap: '0.48rem',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: patientTheme.radius.sm,
    padding: '0.55rem 0.62rem',
    display: 'grid',
    gap: '0.22rem',
  },
  userBubble: {
    justifySelf: 'end',
    background: '#1949b8',
    color: '#fff',
  },
  aiBubble: {
    justifySelf: 'start',
    background: '#f3efe5',
    color: patientTheme.colors.ink,
  },
  bubbleText: {
    margin: 0,
    lineHeight: 1.45,
    fontSize: '0.88rem',
  },
  typingText: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.86rem',
  },
  assessmentCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: 'rgba(255,255,255,0.88)',
    padding: '0.32rem 0.45rem',
    display: 'grid',
    gap: '0.2rem',
  },
  urgencyBadge: {
    borderRadius: '999px',
    width: 'fit-content',
    padding: '0.17rem 0.5rem',
    fontSize: '0.69rem',
    fontWeight: 700,
  },
  assessmentText: {
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.35,
  },
  admitPanel: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    padding: '0.62rem',
    display: 'grid',
    gap: '0.42rem',
  },
  admitTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '0.95rem',
  },
  admitBody: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.82rem',
    lineHeight: 1.4,
  },
  select: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.6rem 0.66rem',
    fontFamily: patientTheme.fonts.body,
    fontSize: '0.88rem',
  },
  inputRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '0.5rem',
    alignItems: 'center',
  },
  input: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.66rem 0.74rem',
    fontSize: '0.92rem',
    fontFamily: patientTheme.fonts.body,
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.66rem 0.86rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    whiteSpace: 'nowrap',
  },
};
