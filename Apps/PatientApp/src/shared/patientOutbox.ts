import { sendPatientMessage } from './api/encounters';
import { ApiError } from './api/client';
import type { Message } from './types/domain';

const OUTBOX_KEY = 'priage.patient.messageOutbox.v1';
const MAX_ATTEMPTS = 12;

type OutboxMessage = {
  id: string;
  encounterId: number;
  content: string;
  isWorsening: boolean;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
};

export class OutboxQueuedError extends Error {
  constructor() {
    super('Message saved to outbox and will retry when connectivity returns');
    this.name = 'OutboxQueuedError';
  }
}

export function isOutboxQueuedError(error: unknown): error is OutboxQueuedError {
  return error instanceof OutboxQueuedError;
}

export async function sendPatientMessageReliable(
  encounterId: number,
  content: string,
  isWorsening = false,
): Promise<Message> {
  const item = createOutboxMessage(encounterId, content, isWorsening);
  upsertOutboxMessage(item);

  try {
    const sent = await sendPatientMessage(
      item.encounterId,
      item.content,
      item.isWorsening,
      item.id,
    );
    removeOutboxMessage(item.id);
    return sent;
  } catch (error) {
    if (!isRetryableSendError(error)) {
      removeOutboxMessage(item.id);
      throw error;
    }
    markOutboxAttempt(item.id);
    throw new OutboxQueuedError();
  }
}

export async function flushPatientMessageOutbox(
  onSent?: (message: Message, encounterId: number) => void,
): Promise<void> {
  const now = Date.now();
  const pending = loadOutboxMessages()
    .filter((item) => item.nextAttemptAt <= now && item.attempts < MAX_ATTEMPTS)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (const item of pending) {
    try {
      const sent = await sendPatientMessage(
        item.encounterId,
        item.content,
        item.isWorsening,
        item.id,
      );
      removeOutboxMessage(item.id);
      onSent?.(sent, item.encounterId);
    } catch (error) {
      if (!isRetryableSendError(error)) {
        removeOutboxMessage(item.id);
      } else {
        markOutboxAttempt(item.id);
      }
    }
  }
}

function isRetryableSendError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return true;
  }

  return error.status === 408 || error.status === 409 || error.status === 429 || error.status >= 500;
}

function createOutboxMessage(
  encounterId: number,
  content: string,
  isWorsening: boolean,
): OutboxMessage {
  return {
    id: `patient-message:${crypto.randomUUID()}`,
    encounterId,
    content,
    isWorsening,
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: Date.now(),
  };
}

function upsertOutboxMessage(item: OutboxMessage): void {
  const existing = loadOutboxMessages().filter((candidate) => candidate.id !== item.id);
  saveOutboxMessages([...existing, item]);
}

function removeOutboxMessage(id: string): void {
  saveOutboxMessages(loadOutboxMessages().filter((item) => item.id !== id));
}

function markOutboxAttempt(id: string): void {
  const next = loadOutboxMessages().map((item) => {
    if (item.id !== id) {
      return item;
    }

    const attempts = item.attempts + 1;
    const backoffMs = Math.min(60_000, 2 ** Math.min(attempts, 6) * 1000);
    return {
      ...item,
      attempts,
      nextAttemptAt: Date.now() + backoffMs,
    };
  });

  saveOutboxMessages(next.filter((item) => item.attempts < MAX_ATTEMPTS));
}

function loadOutboxMessages(): OutboxMessage[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(isOutboxMessage)
      : [];
  } catch {
    return [];
  }
}

function saveOutboxMessages(items: OutboxMessage[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-50)));
}

function isOutboxMessage(value: unknown): value is OutboxMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<OutboxMessage>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.encounterId === 'number' &&
    typeof candidate.content === 'string' &&
    typeof candidate.isWorsening === 'boolean' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.attempts === 'number' &&
    typeof candidate.nextAttemptAt === 'number'
  );
}
