import type { HospitalPageKey } from '../types/domain';

function buildLandingPageStorageKey(userId: number): string {
  return `priage:hospital:landing-page:${userId}`;
}

export function getPreferredLandingPage(
  userId: number,
  allowedViews: HospitalPageKey[],
): HospitalPageKey | null {
  if (typeof window === 'undefined') return allowedViews[0] ?? null;

  const stored = window.localStorage.getItem(buildLandingPageStorageKey(userId));
  if (stored && allowedViews.includes(stored as HospitalPageKey)) {
    return stored as HospitalPageKey;
  }

  return allowedViews[0] ?? null;
}

export function setPreferredLandingPage(userId: number, view: HospitalPageKey): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(buildLandingPageStorageKey(userId), view);
}
