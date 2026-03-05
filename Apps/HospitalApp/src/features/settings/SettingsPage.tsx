// HospitalApp/src/features/settings/SettingsPage.tsx
// Settings page — placeholder until real configuration features are built.

import { NavBar, type View } from '../../shared/ui/NavBar';

interface SettingsPageProps {
  onNavigate: (view: View) => void;
  onLogout: () => void;
  user: { email: string; role: string } | null;
}

export function SettingsPage({ onNavigate, onLogout, user }: SettingsPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar currentView="settings" onNavigate={onNavigate} onLogout={onLogout} user={user} />

      <div className="p-6 max-w-[900px] mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Hospital configuration and preferences</p>

        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl mb-4">
            ⚙️
          </div>
          <h2 className="text-lg font-semibold text-gray-700">Coming Soon</h2>
          <p className="text-sm text-gray-400 mt-1 max-w-md">
            Hospital settings — notifications, staff management, integrations, and department
            configuration — will be available in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
