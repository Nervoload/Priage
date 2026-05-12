import type { EncounterStatus } from '../types/domain';

export interface DashboardStatusTheme {
  summary: string;
  filterActive: string;
  filterIdle: string;
  cardPill: string;
}

export const DASHBOARD_PAGE_CLASS =
  'min-h-screen bg-[#f8fafc] font-sans';

export const DASHBOARD_GLASS_PANEL_CLASS =
  'rounded-[10px] border border-[#e2e8f0] bg-white';

export const DASHBOARD_EMPTY_STATE_CLASS =
  'rounded-[10px] border border-[#e2e8f0] bg-white px-5 py-12 text-center text-sm text-slate-500';

export const DASHBOARD_CARD_GRID_CLASS =
  'grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5';

export const DASHBOARD_STATUS_THEME: Record<EncounterStatus, DashboardStatusTheme> = {
  EXPECTED: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    filterActive: 'border-slate-900 bg-slate-900 text-white',
    filterIdle: 'border-[#e2e8f0] bg-white text-slate-700 hover:bg-slate-50',
    cardPill: 'border border-blue-200 bg-blue-50 text-blue-700',
  },
  ADMITTED: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    filterActive: 'border-slate-900 bg-slate-900 text-white',
    filterIdle: 'border-[#e2e8f0] bg-white text-slate-700 hover:bg-slate-50',
    cardPill: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  TRIAGE: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    filterActive: 'border-slate-900 bg-slate-900 text-white',
    filterIdle: 'border-[#e2e8f0] bg-white text-slate-700 hover:bg-slate-50',
    cardPill: 'border border-amber-200 bg-amber-50 text-amber-700',
  },
  WAITING: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    filterActive: 'border-slate-900 bg-slate-900 text-white',
    filterIdle: 'border-[#e2e8f0] bg-white text-slate-700 hover:bg-slate-50',
    cardPill: 'border border-sky-200 bg-sky-50 text-sky-700',
  },
  COMPLETE: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    filterActive: 'border-slate-900 bg-slate-900 text-white',
    filterIdle: 'border-[#e2e8f0] bg-white text-slate-700 hover:bg-slate-50',
    cardPill: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  UNRESOLVED: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    filterActive: 'border-slate-900 bg-slate-900 text-white',
    filterIdle: 'border-[#e2e8f0] bg-white text-slate-700 hover:bg-slate-50',
    cardPill: 'border border-slate-300 bg-slate-100 text-slate-700',
  },
  CANCELLED: {
    summary: 'border-slate-900 bg-slate-900 text-white',
    filterActive: 'border-slate-900 bg-slate-900 text-white',
    filterIdle: 'border-[#e2e8f0] bg-white text-slate-700 hover:bg-slate-50',
    cardPill: 'border border-rose-200 bg-rose-50 text-rose-700',
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
