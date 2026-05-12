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

      <div className="mx-auto max-w-7xl px-8 py-6">
        <div className="rounded-[10px] border border-[#e2e8f0] bg-white px-6 py-5">
          <h1 className="text-[1.9rem] font-semibold tracking-[-0.03em] text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Hospital configuration and preferences</p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center rounded-[10px] border border-[#e2e8f0] bg-white px-8 py-14 text-center">
          <div className="mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[10px] border border-[#e2e8f0] bg-slate-50 text-2xl text-slate-600">
            ⚙️
          </div>
          <h2 className="text-[1.6rem] font-semibold tracking-[-0.03em] text-slate-800">Coming Soon</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Hospital settings — notifications, staff management, integrations, and department
            configuration — will be available in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
