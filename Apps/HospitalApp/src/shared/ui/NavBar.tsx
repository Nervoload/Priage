// HospitalApp/src/shared/ui/NavBar.tsx
// Shared top navigation bar used across all views.

import type { ReactNode } from 'react';
import type { HospitalPageKey } from '../types/domain';
import { PriageLogo } from './PriageLogo';

export type View = HospitalPageKey;

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
  availableViews?: View[];
  workflowProfile?: 'ED' | 'CLINIC_APPOINTMENT';
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
    key: 'care',
    label: 'Care',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2.5h10v11H3zM5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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

export function NavBar({ currentView, onNavigate, onLogout, user, availableViews, workflowProfile = 'ED' }: NavBarProps) {
  const visibleTabs = tabs
    .filter((tab) => !availableViews || availableViews.includes(tab.key))
    .map((tab) => (
      tab.key === 'admit' && workflowProfile === 'CLINIC_APPOINTMENT' ? { ...tab, label: user?.role === 'IT_ADMIN' ? 'Availability' : 'Reception' } :
      tab.key === 'settings' && (user?.role === 'ADMIN' || user?.role === 'IT_ADMIN' || user?.role === 'CLINICAL_ADMIN')
        ? { ...tab, label: 'Admin Settings' }
        : tab
    ));
  const homeView = visibleTabs.find((tab) => tab.key === 'waiting')?.key ?? visibleTabs[0]?.key ?? 'settings';

  return (
    <nav aria-label="Clinic navigation" className="sticky top-0 z-50 border-b border-white/10 bg-gradient-to-r from-priage-800 to-priage-600 shadow-lg">
      <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 lg:flex-nowrap lg:px-6">
        <div className="order-1 flex shrink-0 items-center">
          <button
            type="button"
            aria-label="Priage Clinic home"
            onClick={() => onNavigate(homeView)}
            className="flex items-center gap-2 rounded-lg text-white transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <PriageLogo size={30} color="#FFFFFF" />
            <span className="font-hospital-display text-xl font-semibold tracking-[-0.03em] text-white">
              Priage Clinic
            </span>
          </button>
        </div>

        <div className="order-3 w-full min-w-0 overflow-x-auto lg:order-2 lg:flex-1">
          <div className="flex min-w-max items-center gap-1">
            {visibleTabs.map((tab) => {
              const isActive = currentView === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigate(tab.key)}
                  className={`
                    flex min-h-[44px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border-b-2 px-3 py-2
                    font-hospital-display text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white
                    ${isActive ? 'border-white text-white' : 'border-transparent text-white/75 hover:bg-white/10 hover:text-white'}
                  `}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap lg:order-3">
          {user && (
            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-sm font-bold text-white">
                {user.email[0].toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-col items-end">
                <span className="max-w-[150px] truncate text-sm font-medium leading-tight text-white/92 xl:max-w-[220px]">{user.email}</span>
                <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-priage-200">{user.role}</span>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="shrink-0 rounded-md px-2.5 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
