import { ApiError } from '../../../shared/api/client';

/** The server's own sentence for validation and conflict errors; null for anything else. */
export function serverMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || ![400, 409, 422].includes(error.status)) return null;
  try {
    const parsed = JSON.parse(error.body) as { message?: unknown };
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim();
    if (Array.isArray(parsed.message) && typeof parsed.message[0] === 'string') return parsed.message[0];
  } catch {
    // Plain-text bodies are not shown to staff.
  }
  return null;
}

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

/** Explains what happened and what to do, in the interface's voice. */
export function describeError(error: unknown, fallback: string): string {
  if (error instanceof TypeError) return 'The connection dropped. Check the network, then try again.';
  const message = serverMessage(error);
  if (!message) return fallback;
  return /[.!?]$/.test(message) ? message : `${message}.`;
}
