import { useRef, useState, useEffect } from 'react';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import { updateIntakeDetails } from '../../shared/api/intake';
import { heroBackdrop, panelBorder, patientTheme } from '../../shared/ui/theme';

interface GuestChatbotPageProps {
    onChooseHospital: () => void;
    onBack?: () => void;
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const OPENAI_API_KEY =
    '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';

const MAX_QUESTIONS = 5;

function buildSystemPrompt(firstName?: string, lastName?: string, chiefComplaint?: string): string {
    const name = [firstName, lastName].filter(Boolean).join(' ') || 'the patient';
    const complaintContext = chiefComplaint
        ? `The patient described their reason for visiting as: "${chiefComplaint}".`
        : '';

    return `You are a friendly, empathetic AI health assistant embedded in Priage, an emergency-department check-in app. The patient has just submitted a fast emergency intake form.

Patient name: ${name}.
${complaintContext}

Your role is to:
1. Greet the patient by their name ("Hi ${name}") and empathetically acknowledge what they are going through based on their stated concern. Show genuine sympathy, e.g. "I'm sorry you're dealing with that" or "That sounds really uncomfortable."
2. Then ask focused follow-up questions ONE AT A TIME to help the care team prepare. Ask about: symptom duration, severity (1-10 scale), any changes/worsening, relevant medical history, current medications, and allergies.
3. You may only ask a MAXIMUM of ${MAX_QUESTIONS} questions total (including your greeting message). After your ${MAX_QUESTIONS}th message, send a short closing message thanking the patient and telling them their care team will have this information ready.
4. Keep each message short (2-4 sentences max) and reassuring — they may be anxious.
5. Do NOT diagnose or prescribe. Remind them that a medical team will see them soon.
6. If they mention a life-threatening emergency (chest pain, difficulty breathing, severe bleeding), advise calling 911 immediately.
7. Keep a warm, professional tone throughout.`;
}

function formatTranscript(messages: ChatMessage[]): string {
    return messages
        .filter((m) => m.role !== 'system')
        .map((m) => `[${m.role === 'user' ? 'Patient' : 'AI Assistant'}] ${m.content}`)
        .join('\n\n');
}

export function GuestChatbotPage({ onChooseHospital, onBack }: GuestChatbotPageProps) {
    const { session } = useGuestSession();
    const systemPrompt = buildSystemPrompt(session?.firstName, session?.lastName, session?.chiefComplaint);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const initialGreetingSent = useRef(false);
    const transcriptSaved = useRef(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const assistantCount = messages.filter((m) => m.role === 'assistant').length;
    const chatComplete = assistantCount >= MAX_QUESTIONS;

    // Save transcript to backend when chat completes
    useEffect(() => {
        if (!chatComplete || transcriptSaved.current) return;
        transcriptSaved.current = true;

        const transcript = formatTranscript(messages);
        setSaveStatus('saving');
        updateIntakeDetails({ details: transcript })
            .then(() => setSaveStatus('saved'))
            .catch(() => setSaveStatus('error'));
    }, [chatComplete, messages]);

    // Scroll to bottom when messages change
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Send initial greeting on mount
    useEffect(() => {
        if (initialGreetingSent.current) return;
        initialGreetingSent.current = true;
        void fetchAssistantResponse([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchAssistantResponse(currentMessages: ChatMessage[]) {
        setStreaming(true);

        const apiMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
        ];

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: apiMessages,
                    max_tokens: 300,
                    temperature: 0.7,
                }),
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            const assistantContent: string =
                data.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't process that. Please try again.";

            setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: "Sorry, I'm having trouble connecting right now. You can continue to choose your hospital below." },
            ]);
        } finally {
            setStreaming(false);
        }
    }

    async function handleSend() {
        const text = input.trim();
        if (!text || streaming || chatComplete) return;

        const userMessage: ChatMessage = { role: 'user', content: text };
        const updated = [...messages, userMessage];
        setMessages(updated);
        setInput('');
        await fetchAssistantResponse(updated);
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSend();
        }
    }

    return (
        <main style={styles.page}>
            <section style={styles.card}>
                {/* Back button */}
                {onBack && (
                    <button style={styles.backButton} onClick={onBack} type="button">
                        ← Back
                    </button>
                )}

                {/* Header */}
                <header style={styles.header}>
                    <span style={styles.badge}>AI Assistant</span>
                    <h1 style={styles.title}>Chat with our Health Assistant</h1>
                    <p style={styles.subtitle}>
                        Our AI assistant can gather additional details to help the care team prepare for your visit. Feel free to ask any questions.
                    </p>
                </header>

                {/* Chat area */}
                <div style={styles.chatArea}>
                    {messages.length === 0 && !streaming && (
                        <div style={styles.emptyState}>
                            <span style={styles.emptyIcon}>💬</span>
                            <p style={styles.emptyText}>Starting conversation…</p>
                        </div>
                    )}

                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            style={{
                                ...styles.messageBubble,
                                ...(msg.role === 'user' ? styles.userBubble : styles.assistantBubble),
                            }}
                        >
                            <span style={styles.messageRole}>{msg.role === 'user' ? 'You' : 'AI Assistant'}</span>
                            <p style={styles.messageText}>{msg.content}</p>
                        </div>
                    ))}

                    {streaming && (
                        <div style={{ ...styles.messageBubble, ...styles.assistantBubble }}>
                            <span style={styles.messageRole}>AI Assistant</span>
                            <p style={styles.messageText}>
                                <span style={styles.typingIndicator}>
                                    <span style={styles.dot}>●</span> <span style={styles.dot}>●</span>{' '}
                                    <span style={styles.dot}>●</span>
                                </span>
                            </p>
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>

                {/* Input bar */}
                {chatComplete ? (
                    <div style={styles.completeMessage}>
                        ✅ Assessment complete
                        {saveStatus === 'saving' && ' — sending your answers to the care team…'}
                        {saveStatus === 'saved' && ' — your answers have been sent to the care team.'}
                        {saveStatus === 'error' && ' — could not save answers, but you can still continue.'}
                        {saveStatus === 'idle' && ''}
                        <br />
                        Tap <strong>"Choose hospital"</strong> below to continue.
                    </div>
                ) : (
                    <div style={styles.inputBar}>
                        <input
                            style={styles.chatInput}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message…"
                            disabled={streaming}
                        />
                        <button
                            style={{
                                ...styles.sendButton,
                                opacity: streaming || !input.trim() ? 0.5 : 1,
                            }}
                            onClick={() => void handleSend()}
                            disabled={streaming || !input.trim()}
                            type="button"
                        >
                            Send
                        </button>
                    </div>
                )}

                {/* Choose hospital button */}
                <button style={styles.primaryButton} type="button" onClick={onChooseHospital}>
                    Choose hospital
                </button>

                <footer style={styles.footer}>
                    When you're ready, tap <strong>"Choose hospital"</strong> to select your destination and notify the care team.
                </footer>
            </section>

            {/* Typing animation keyframes */}
            <style>{`
        @keyframes blink {
          0%, 20% { opacity: 0.2; }
          50% { opacity: 1; }
          80%, 100% { opacity: 0.2; }
        }
      `}</style>
        </main>
    );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
        background: heroBackdrop,
        fontFamily: patientTheme.fonts.body,
    },
    card: {
        width: '100%',
        maxWidth: '680px',
        border: panelBorder,
        borderRadius: patientTheme.radius.xl,
        background: 'rgba(255, 253, 248, 0.98)',
        boxShadow: patientTheme.shadows.panel,
        padding: '1rem',
        display: 'grid',
        gap: '0.72rem',
    },
    backButton: {
        border: 'none',
        background: 'none',
        color: patientTheme.colors.inkMuted,
        fontWeight: 600,
        fontSize: '0.84rem',
        cursor: 'pointer',
        padding: '0.2rem 0',
        fontFamily: patientTheme.fonts.body,
        justifySelf: 'start',
    },
    header: {
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
        padding: '0.28rem 0.72rem',
        fontSize: '0.74rem',
        fontWeight: 700,
    },
    title: {
        margin: 0,
        fontFamily: patientTheme.fonts.heading,
        fontSize: '1.32rem',
    },
    subtitle: {
        margin: 0,
        fontSize: '0.88rem',
        lineHeight: 1.45,
        color: patientTheme.colors.inkMuted,
    },

    /* Chat area */
    chatArea: {
        border: panelBorder,
        borderRadius: patientTheme.radius.md,
        background: '#fff',
        padding: '0.75rem',
        minHeight: '280px',
        maxHeight: '420px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: '0.4rem',
    },
    emptyIcon: {
        fontSize: '2rem',
    },
    emptyText: {
        color: patientTheme.colors.inkMuted,
        fontSize: '0.85rem',
    },

    /* Message bubbles */
    messageBubble: {
        padding: '0.6rem 0.8rem',
        borderRadius: patientTheme.radius.sm,
        maxWidth: '85%',
    },
    userBubble: {
        alignSelf: 'flex-end',
        background: patientTheme.colors.accent,
        color: '#fff',
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        background: patientTheme.colors.accentSoft,
        color: patientTheme.colors.ink,
    },
    messageRole: {
        fontSize: '0.68rem',
        fontWeight: 700,
        opacity: 0.7,
        display: 'block',
        marginBottom: '0.18rem',
    },
    messageText: {
        margin: 0,
        fontSize: '0.88rem',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
    },

    /* Typing indicator */
    typingIndicator: {
        display: 'inline-flex',
        gap: '0.25rem',
    },
    dot: {
        animation: 'blink 1.2s infinite',
        fontSize: '0.7rem',
    },

    /* Input bar */
    inputBar: {
        display: 'flex',
        gap: '0.45rem',
        alignItems: 'center',
    },
    chatInput: {
        flex: 1,
        border: panelBorder,
        borderRadius: patientTheme.radius.sm,
        background: '#fff',
        color: patientTheme.colors.ink,
        padding: '0.62rem 0.74rem',
        fontSize: '0.9rem',
        fontFamily: patientTheme.fonts.body,
        boxSizing: 'border-box' as const,
    },
    sendButton: {
        border: 'none',
        borderRadius: patientTheme.radius.sm,
        background: patientTheme.colors.accent,
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.85rem',
        padding: '0.62rem 1rem',
        cursor: 'pointer',
        fontFamily: patientTheme.fonts.body,
        whiteSpace: 'nowrap',
    },

    /* Primary CTA */
    primaryButton: {
        border: 'none',
        borderRadius: patientTheme.radius.sm,
        background: patientTheme.colors.accent,
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.92rem',
        padding: '0.74rem 0.9rem',
        cursor: 'pointer',
        fontFamily: patientTheme.fonts.body,
    },

    footer: {
        borderTop: panelBorder,
        paddingTop: '0.62rem',
        color: patientTheme.colors.inkMuted,
        fontSize: '0.8rem',
        lineHeight: 1.45,
    },

    completeMessage: {
        border: `1px solid ${patientTheme.colors.success}`,
        borderRadius: patientTheme.radius.sm,
        background: '#edfcf5',
        color: patientTheme.colors.success,
        padding: '0.7rem 0.9rem',
        fontSize: '0.88rem',
        fontWeight: 600,
        lineHeight: 1.45,
        textAlign: 'center' as const,
    },
};
