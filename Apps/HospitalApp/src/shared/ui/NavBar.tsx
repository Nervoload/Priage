// HospitalApp/src/shared/ui/NavBar.tsx
// Shared top navigation bar used across all views.

import type { ReactNode } from 'react';

export type View = 'admit' | 'triage' | 'waiting' | 'analytics' | 'settings';

interface NavTab {
  key: View;
  label: string;
  icon: ReactNode;
}

interface NavBarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  user: { email: string; role: string } | null;
}

const tabs: NavTab[] = [
  {
    key: 'admit',
    label: 'Admittance',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M3 14c0-2.5 2.5-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    key: 'triage',
    label: 'Triage',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'waiting',
    label: 'Waiting Room',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="8" width="3" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <rect x="6.5" y="4" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <rect x="11" y="2" width="3" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function NavBar({ currentView, onNavigate, onLogout, user }: NavBarProps) {
  return (
    <nav className="sticky top-0 z-50 overflow-visible border-b border-white/10 bg-gradient-to-r from-priage-800 to-priage-600 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
      <div className="relative h-[72px] px-6">
        <div className="absolute left-6 top-1/2 z-30 flex min-w-[220px] -translate-y-1/2 items-center justify-start">
          <button
            onClick={() => onNavigate('waiting')}
            className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1 text-white/95 transition-all duration-200 hover:text-white cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/18 text-sm font-black text-white ring-1 ring-white/25 transition-all duration-200 group-hover:bg-white/24">
              P
            </div>
            <span className="font-hospital-display text-[1.35rem] font-semibold tracking-[-0.03em] text-white">
              Priage
            </span>
          </button>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex w-[min(820px,calc(100vw-29rem))] max-w-[calc(100vw-8rem)] min-w-[560px] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <div className="pointer-events-auto grid w-full grid-cols-5 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            {tabs.map((tab) => {
              const isActive = currentView === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onNavigate(tab.key)}
                  className={`
                    group relative flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-center
                    font-hospital-display text-[0.96rem] font-semibold tracking-[-0.02em] transition-all duration-200 cursor-pointer
                    ${isActive
                      ? 'bg-white/14 text-white shadow-[0_10px_26px_-18px_rgba(15,23,42,0.9)]'
                      : 'text-white/70 hover:bg-white/8 hover:text-white'
                    }
                  `}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="absolute right-6 top-1/2 z-30 flex min-w-[320px] -translate-y-1/2 items-center justify-end gap-4 whitespace-nowrap">
          {user && (
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-600 text-sm font-bold text-white shadow-[0_12px_22px_-14px_rgba(220,38,38,0.8)]">
                {user.email[0].toUpperCase()}
              </div>
              <div className="flex min-w-0 shrink-0 flex-col items-end">
                <span className="max-w-[220px] truncate text-[14px] font-medium leading-tight text-white/92">{user.email}</span>
                <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-priage-200">{user.role}</span>
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            className="shrink-0 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[14px] font-medium text-white/80 transition-all duration-200 hover:border-white/25 hover:bg-white/12 hover:text-red-200 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
