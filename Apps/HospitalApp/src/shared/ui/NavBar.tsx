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
    <nav className="sticky top-0 z-50 overflow-visible border-b border-white/10 bg-gradient-to-r from-priage-800 to-priage-600 shadow-lg">
      <div className="relative h-16 px-6">
        <div className="absolute left-6 top-1/2 z-30 flex min-w-[220px] -translate-y-1/2 items-center justify-start">
          <button
            onClick={() => onNavigate('waiting')}
            className="flex items-center gap-2 text-white transition-opacity hover:opacity-80"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-sm font-black text-white ring-1 ring-white/20">
              P
            </div>
            <span className="font-hospital-display text-xl font-semibold tracking-[-0.03em] text-white">
              Priage
            </span>
          </button>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex w-[min(780px,calc(100vw-30rem))] max-w-[calc(100vw-8rem)] min-w-[560px] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <div className="pointer-events-auto grid w-full grid-cols-5 items-end gap-3">
            {tabs.map((tab) => {
              const isActive = currentView === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onNavigate(tab.key)}
                  className={`
                    group relative flex min-h-[46px] items-center justify-center gap-2 whitespace-nowrap px-3 pb-3 pt-2 text-center
                    font-hospital-display text-base font-semibold tracking-[-0.02em] transition-all duration-150 cursor-pointer
                    ${isActive ? 'text-white' : 'text-white/68 hover:text-white'}
                  `}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span
                    className={`
                      pointer-events-none absolute bottom-0 left-1/2 z-20 h-0.5 w-12 -translate-x-1/2 rounded-full transition-all duration-150
                      ${isActive ? 'bg-white' : 'bg-transparent group-hover:bg-white/45'}
                    `}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="absolute right-6 top-1/2 z-30 flex min-w-[320px] -translate-y-1/2 items-center justify-end gap-4 whitespace-nowrap">
          {user && (
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-sm font-bold text-white">
                {user.email[0].toUpperCase()}
              </div>
              <div className="flex min-w-0 shrink-0 flex-col items-end">
                <span className="max-w-[220px] truncate text-[15px] font-medium leading-tight text-white/92">{user.email}</span>
                <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-priage-200">{user.role}</span>
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-[15px] font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-red-300 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
