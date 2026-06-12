import type { EncounterStatus } from '../types/domain';

export interface DashboardStatusTheme {
  summary: string;
  filterActive: string;
  filterIdle: string;
  cardPill: string;
}

export const DASHBOARD_PAGE_CLASS =
  'min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,247,237,0.95)_0%,_rgba(248,250,252,1)_34%,_rgba(241,245,249,1)_100%)] font-hospital-body';

export const DASHBOARD_GLASS_PANEL_CLASS =
  'rounded-[30px] border border-white/80 bg-white/80 backdrop-blur-xl shadow-[0_24px_80px_-48px_rgba(15,23,42,0.55)]';

export const DASHBOARD_EMPTY_STATE_CLASS =
  'rounded-[28px] border border-slate-200/80 bg-white/90 px-5 py-12 text-center text-sm text-slate-500 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.55)]';

export const DASHBOARD_CARD_GRID_CLASS =
  'grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5';

export const DASHBOARD_STATUS_THEME: Record<EncounterStatus, DashboardStatusTheme> = {
  EXPECTED: {
    summary: 'border-sky-600 bg-sky-600 text-white shadow-[0_20px_45px_-28px_rgba(2,132,199,0.92)]',
    filterActive: 'border-sky-600 bg-sky-600 text-white shadow-[0_16px_36px_-26px_rgba(2,132,199,0.92)]',
    filterIdle: 'border-sky-200 bg-white text-sky-900 hover:border-sky-300 hover:bg-sky-50',
    cardPill: 'border-transparent bg-sky-100 text-sky-800 shadow-none',
  },
  ADMITTED: {
    summary: 'border-teal-600 bg-teal-600 text-white shadow-[0_20px_45px_-28px_rgba(13,148,136,0.92)]',
    filterActive: 'border-teal-600 bg-teal-600 text-white shadow-[0_16px_36px_-26px_rgba(13,148,136,0.92)]',
    filterIdle: 'border-teal-200 bg-white text-teal-900 hover:border-teal-300 hover:bg-teal-50',
    cardPill: 'border-transparent bg-emerald-100 text-emerald-800 shadow-none',
  },
  TRIAGE: {
    summary: 'border-amber-600 bg-amber-600 text-white shadow-[0_20px_45px_-28px_rgba(217,119,6,0.95)]',
    filterActive: 'border-amber-600 bg-amber-600 text-white shadow-[0_16px_36px_-26px_rgba(217,119,6,0.95)]',
    filterIdle: 'border-amber-200 bg-white text-amber-900 hover:border-amber-300 hover:bg-amber-50',
    cardPill: 'border-transparent bg-amber-600 text-white shadow-[0_12px_28px_-22px_rgba(217,119,6,0.95)]',
  },
  WAITING: {
    summary: 'border-sky-700 bg-sky-700 text-white shadow-[0_20px_45px_-28px_rgba(3,105,161,0.95)]',
    filterActive: 'border-sky-700 bg-sky-700 text-white shadow-[0_16px_36px_-26px_rgba(3,105,161,0.95)]',
    filterIdle: 'border-sky-200 bg-white text-sky-900 hover:border-sky-300 hover:bg-sky-50',
    cardPill: 'border-transparent bg-sky-700 text-white shadow-[0_12px_28px_-22px_rgba(3,105,161,0.95)]',
  },
  COMPLETE: {
    summary: 'border-emerald-600 bg-emerald-600 text-white shadow-[0_20px_45px_-28px_rgba(5,150,105,0.95)]',
    filterActive: 'border-emerald-600 bg-emerald-600 text-white shadow-[0_16px_36px_-26px_rgba(5,150,105,0.95)]',
    filterIdle: 'border-emerald-200 bg-white text-emerald-900 hover:border-emerald-300 hover:bg-emerald-50',
    cardPill: 'border-transparent bg-emerald-100 text-emerald-800 shadow-none',
  },
  UNRESOLVED: {
    summary: 'border-slate-700 bg-slate-700 text-white shadow-[0_20px_45px_-28px_rgba(51,65,85,0.95)]',
    filterActive: 'border-slate-700 bg-slate-700 text-white shadow-[0_16px_36px_-26px_rgba(51,65,85,0.95)]',
    filterIdle: 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50',
    cardPill: 'border-transparent bg-slate-700 text-white shadow-[0_12px_28px_-22px_rgba(51,65,85,0.95)]',
  },
  CANCELLED: {
    summary: 'border-rose-700 bg-rose-700 text-white shadow-[0_20px_45px_-28px_rgba(190,24,93,0.95)]',
    filterActive: 'border-rose-700 bg-rose-700 text-white shadow-[0_16px_36px_-26px_rgba(190,24,93,0.95)]',
    filterIdle: 'border-rose-200 bg-white text-rose-900 hover:border-rose-300 hover:bg-rose-50',
    cardPill: 'border-transparent bg-rose-700 text-white shadow-[0_12px_28px_-22px_rgba(190,24,93,0.95)]',
  },
};

const DASHBOARD_AVATAR_THEMES = [
  { gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 52%, #fb7185 100%)', accent: '#ea580c' },
  { gradient: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 48%, #67e8f9 100%)', accent: '#14b8a6' },
  { gradient: 'linear-gradient(135deg, #4338ca 0%, #2563eb 48%, #60a5fa 100%)', accent: '#2563eb' },
  { gradient: 'linear-gradient(135deg, #be185d 0%, #ec4899 45%, #fb7185 100%)', accent: '#ec4899' },
  { gradient: 'linear-gradient(135deg, #166534 0%, #16a34a 50%, #4ade80 100%)', accent: '#16a34a' },
  { gradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 46%, #facc15 100%)', accent: '#ea580c' },
  { gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 52%, #93c5fd 100%)', accent: '#3b82f6' },
  { gradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 44%, #c084fc 100%)', accent: '#7c3aed' },
] as const;

export function getDashboardAvatarTheme(seed: number) {
  return DASHBOARD_AVATAR_THEMES[Math.abs(seed) % DASHBOARD_AVATAR_THEMES.length];
}

export function getDashboardInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatDashboardPatientSex(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return 'Sex N/A';

  const lower = normalized.toLowerCase();
  if (lower === 'm' || lower === 'male') return 'Male';
  if (lower === 'f' || lower === 'female') return 'Female';
  if (lower === 'nb' || lower === 'non-binary' || lower === 'nonbinary') return 'Non-binary';

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatDashboardElapsedMinutes(minutes: number): string {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
