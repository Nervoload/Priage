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
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-6 h-14">
        {/* Left: Logo + Tabs */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <button
            onClick={() => onNavigate('waiting')}
            className="flex items-center gap-2 text-priage-600 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-priage-600 text-white flex items-center justify-center text-sm font-black">
              P
            </div>
            <span>Priage</span>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-200" />

          {/* Tab buttons */}
          <div className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = currentView === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onNavigate(tab.key)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                    transition-all duration-150 cursor-pointer
                    ${isActive
                      ? 'bg-priage-50 text-priage-700 shadow-sm ring-1 ring-priage-200'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  {tab.icon}
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: User info + logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-priage-600 text-white flex items-center justify-center text-xs font-bold">
                {user.email[0].toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-xs font-medium text-gray-700 leading-tight">{user.email}</span>
                <span className="text-[10px] font-semibold text-priage-600 uppercase leading-tight">{user.role}</span>
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
