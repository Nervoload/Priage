import { describe, expect, it } from 'vitest';
import { messageToChatMessage, type Message } from './domain';

function message(overrides: Partial<Message>): Message {
  return {
    id: 5,
    encounterId: 81,
    senderType: 'USER',
    content: 'Check allergies before discharge',
    isInternal: false,
    createdAt: '2026-10-02T12:00:00.000Z',
    ...overrides,
  } as Message;
}

describe('staff chat messages', () => {
  it('keeps the internal-note flag so staff can tell notes from patient-visible messages', () => {
    expect(messageToChatMessage(message({ isInternal: true })).isInternal).toBe(true);
    expect(messageToChatMessage(message({ isInternal: false })).isInternal).toBe(false);
  });
});
