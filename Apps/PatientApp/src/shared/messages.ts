import type { EncounterSummary, Message } from './types/domain';
import { isActiveEncounter } from './encounters';

export function chooseMessageEncounter(encounters: EncounterSummary[], requestedId: number | null): EncounterSummary | null {
  if (requestedId != null) {
    const requested = encounters.find((encounter) => encounter.id === requestedId);
    if (requested) return requested;
  }

  return encounters.find((encounter) => isActiveEncounter(encounter.status)) ?? encounters[0] ?? null;
}

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

  return [...existing, ...additions].sort((left, right) => left.id - right.id);
}
