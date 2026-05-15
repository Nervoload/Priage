import type { Message } from './types/domain';

export function getLastMessageId(messages: Message[]): number | null {
  if (messages.length === 0) {
    return null;
  }

  return messages[messages.length - 1]?.id ?? null;
}

export function appendUniqueMessages(existing: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) {
    return existing;
  }

  const seen = new Set(existing.map((message) => message.id));
  const additions = incoming.filter((message) => !seen.has(message.id));

  if (additions.length === 0) {
    return existing;
  }

  return [...existing, ...additions];
}
