import type { GuestIntakeSession } from './types/domain';

export function resolveGuestPath(session: GuestIntakeSession | null): string {
  if (!session) {
    return '/welcome';
  }

  if (session.hospitalSlug && session.encounterId) {
    return `/guest/enroute/${session.encounterId}`;
  }

  return '/guest/chatbot';
}

export function getGuestResumeLabel(session: GuestIntakeSession | null): string {
  if (!session) {
    return 'Resume guest check-in';
  }

  if (session.hospitalSlug && session.encounterId) {
    return 'Return to active visit';
  }

  return 'Resume guest check-in';
}
