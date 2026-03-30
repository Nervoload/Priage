// HospitalApp/src/features/settings/SettingsPage.tsx
// Settings page — placeholder until real configuration features are built.

import { NavBar, type View } from '../../shared/ui/NavBar';
import { DASHBOARD_PAGE_CLASS } from '../../shared/ui/dashboardTheme';

interface SettingsPageProps {
  onNavigate: (view: View) => void;
  onLogout: () => void;
  user: { email: string; role: string } | null;
}

export function SettingsPage({ onNavigate, onLogout, user }: SettingsPageProps) {
  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <NavBar currentView="settings" onNavigate={onNavigate} onLogout={onLogout} user={user} />

      <div className="mx-auto max-w-[980px] px-4 py-5 sm:px-5 lg:px-6">
        <div className="rounded-[28px] border border-white/80 bg-white/78 px-6 py-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.5)] backdrop-blur-sm">
          <h1 className="font-hospital-display text-[1.9rem] font-semibold tracking-[-0.03em] text-slate-950">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Hospital configuration and preferences</p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center rounded-[30px] border border-slate-200/80 bg-white/92 px-8 py-14 text-center shadow-[0_24px_70px_-48px_rgba(15,23,42,0.38)]">
          <div className="mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[24px] bg-slate-100 text-2xl text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            ⚙️
          </div>
          <h2 className="font-hospital-display text-[1.6rem] font-semibold tracking-[-0.03em] text-slate-800">Coming Soon</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Hospital settings — notifications, staff management, integrations, and department
            configuration — will be available in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
