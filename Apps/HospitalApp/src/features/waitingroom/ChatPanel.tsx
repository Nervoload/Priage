// HospitalApp/src/features/waitingroom/ChatPanel.tsx
// Private chat panel for a single patient – admin side
// TODO: Connect to backend WebSocket for real-time messaging
//
// Phase 6.2: Replace the local-only messaging flow with live WebSocket chat:
//   1. Import { getSocket } from '../../shared/realtime/socket' and listen for
//      'message.created' events filtered to this encounter.id.
//   2. Wire handleSend to emit via socket (or call sendMessage from messaging.ts
//      API) instead of the parent’s local-state onSendMessage callback.
//   3. Remove the placeholder banner below once messages flow through the backend.
//   4. Fetch message history on mount via listMessages() from messaging.ts.

import { useState, useRef, useEffect } from 'react';
import type { Encounter, ChatMessage } from '../../app/HospitalApp';
import { patientName } from '../../app/HospitalApp';

interface ChatPanelProps {
    encounter: Encounter;
    messages: ChatMessage[];
    onSendMessage: (encounterId: number, text: string) => void;
}

export function ChatPanel({ encounter, messages, onSendMessage }: ChatPanelProps) {
    const [draft, setDraft] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const handleSend = () => {
        const text = draft.trim();
        if (!text) return;
        onSendMessage(encounter.id, text);
        setDraft('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp: string) => {
        const d = new Date(timestamp);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Chat Header */}
            <div
                style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                }}
            >
                <div
                    style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#7c3aed',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                    }}
                >
                    {patientName(encounter.patient).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1f2937' }}>
                        {patientName(encounter.patient)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        #{encounter.id} · {encounter.chiefComplaint ?? 'N/A'}
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                }}
            >
                {/* Placeholder banner */}
                {/* TODO: Remove this banner once backend WebSocket is connected */}
                <div
                    style={{
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        fontSize: '0.8rem',
                        color: '#1e40af',
                        textAlign: 'center',
                        marginBottom: '0.5rem',
                    }}
                >
                    💬 Patient messages will appear here once the backend is connected.
                    <br />
                    <span style={{ fontSize: '0.7rem', color: '#3b82f6' }}>
                        Admin messages are saved locally for now.
                    </span>
                </div>

                {messages.length === 0 && (
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#9ca3af',
                            fontSize: '0.875rem',
                            fontStyle: 'italic',
                        }}
                    >
                        No messages yet. Start the conversation below.
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            display: 'flex',
                            justifyContent: msg.sender === 'admin' ? 'flex-end' : 'flex-start',
                        }}
                    >
                        <div
                            style={{
                                maxWidth: '75%',
                                padding: '0.6rem 0.9rem',
                                borderRadius: msg.sender === 'admin'
                                    ? '12px 12px 4px 12px'
                                    : '12px 12px 12px 4px',
                                backgroundColor: msg.sender === 'admin' ? '#7c3aed' : '#f3f4f6',
                                color: msg.sender === 'admin' ? 'white' : '#1f2937',
                                fontSize: '0.875rem',
                                lineHeight: 1.5,
                            }}
                        >
                            <div>{msg.text}</div>
                            <div
                                style={{
                                    fontSize: '0.65rem',
                                    marginTop: '0.25rem',
                                    opacity: 0.7,
                                    textAlign: 'right',
                                }}
                            >
                                {formatTime(msg.timestamp)}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div
                style={{
                    padding: '0.75rem 1.25rem',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'flex-end',
                }}
            >
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    style={{
                        flex: 1,
                        padding: '0.6rem 0.85rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        resize: 'none',
                        outline: 'none',
                        fontFamily: 'inherit',
                        lineHeight: 1.5,
                        maxHeight: '80px',
                        overflowY: 'auto',
                        backgroundColor: 'white',
                        color: '#000000',
                    }}
                />
                <button
                    onClick={handleSend}
                    disabled={!draft.trim()}
                    style={{
                        padding: '0.6rem 1.15rem',
                        backgroundColor: draft.trim() ? '#7c3aed' : '#d1d5db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: draft.trim() ? 'pointer' : 'default',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        transition: 'background-color 0.15s',
                        whiteSpace: 'nowrap',
                    }}
                    onMouseOver={(e) => {
                        if (draft.trim()) e.currentTarget.style.backgroundColor = '#6d28d9';
                    }}
                    onMouseOut={(e) => {
                        if (draft.trim()) e.currentTarget.style.backgroundColor = '#7c3aed';
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    );
}
