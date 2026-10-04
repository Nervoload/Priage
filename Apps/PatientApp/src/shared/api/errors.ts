import { ApiError } from './client';

/** Turns API and network failures into a sentence a patient can act on. */
export function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    try {
      const parsed = JSON.parse(error.body) as { message?: string | string[] };
      const message = Array.isArray(parsed.message) ? parsed.message.join(' ') : parsed.message;
      // Only validation and conflict responses carry sentences meant for people.
      if (typeof message === 'string' && message.trim() && [400, 409, 422, 429].includes(error.status)) {
        return message.trim();
      }
    } catch {
      // Non-JSON bodies fall through to the fallback.
    }
    return fallback;
  }

  if (error instanceof TypeError) {
    return 'We could not reach Priage. Check your connection and try again.';
  }

  if (error instanceof Error && error.message && !error.message.startsWith('API ')) {
    return error.message;
  }

  return fallback;
}
