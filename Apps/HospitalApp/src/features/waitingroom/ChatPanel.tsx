import { useEffect, useRef, useState } from 'react';
import type { Encounter, ChatMessage } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { getDashboardAvatarTheme, getDashboardInitials } from '../../shared/ui/dashboardTheme';

interface ChatPanelProps {
  encounter: Encounter;
  messages: ChatMessage[];
  onSendMessage: (encounterId: number, text: string) => Promise<void>;
  hideHeader?: boolean;
}

export function ChatPanel({ encounter, messages, onSendMessage, hideHeader = false }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const name = patientName(encounter.patient);
  const avatarTheme = getDashboardAvatarTheme(encounter.patientId);
  const initials = getDashboardInitials(name);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    try {
      setSending(true);
      await onSendMessage(encounter.id, text);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {!hideHeader && (
        <div className="border-b border-[#e2e8f0] bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-[6px] text-sm font-bold text-white"
              style={{ backgroundImage: avatarTheme.gradient }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-[-0.03em] text-slate-900">
                Conversation with {name}
              </div>
              <div className="truncate text-xs font-medium text-slate-500">
                #{encounter.id} · {encounter.chiefComplaint ?? 'No complaint recorded'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto px-6 custom-scrollbar ${hideHeader ? 'py-6' : 'py-5'}`}>
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="max-w-xs rounded-[10px] border border-[#e2e8f0] bg-white px-5 py-6">
              <div className="text-sm font-semibold text-slate-700">No messages yet</div>
              <p className="mt-1 text-xs text-slate-500">Start the conversation below to contact the patient.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => {
              const isAdmin = message.sender === 'admin';
              return (
                <div key={message.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`
                      max-w-[72%] rounded-[8px] px-4 py-3 text-sm
                      ${isAdmin
                        ? 'rounded-br-[4px] bg-slate-900 text-white'
                        : 'rounded-bl-[4px] border border-[#e2e8f0] bg-white text-slate-800'
                      }
                    `}
                  >
                    <div className="whitespace-pre-wrap break-words leading-6">{message.text}</div>
                    <div className={`mt-2 text-[11px] ${isAdmin ? 'text-white/70' : 'text-slate-400'}`}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-[#e2e8f0] bg-white px-6 py-4">
        <div className="flex items-end gap-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="
              max-h-24 min-h-[44px] flex-1 resize-none rounded-[8px] border border-[#e2e8f0] bg-white px-4 py-3
              text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400
              focus:border-[#3b82f6] focus:ring-2 focus:ring-[rgba(59,130,246,0.1)]
            "
          />
          <button
            onClick={() => {
              void handleSend();
            }}
            disabled={!draft.trim() || sending}
            className="
              shrink-0 rounded-[8px] bg-slate-900 px-4 py-3 text-sm font-semibold text-white
              transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300
            "
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
