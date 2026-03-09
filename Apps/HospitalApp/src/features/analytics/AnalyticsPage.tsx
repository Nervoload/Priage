// HospitalApp/src/features/analytics/AnalyticsPage.tsx
// Analytics page — placeholder until real reporting features are built.

import { NavBar, type View } from '../../shared/ui/NavBar';

interface AnalyticsPageProps {
  onNavigate: (view: View) => void;
  onLogout: () => void;
  user: { email: string; role: string } | null;
}

export function AnalyticsPage({ onNavigate, onLogout, user }: AnalyticsPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar currentView="analytics" onNavigate={onNavigate} onLogout={onLogout} user={user} />

      <div className="p-6 max-w-[1200px] mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">Department Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Emergency Department — Real-time overview</p>

        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl mb-4">
            📊
          </div>
          <h2 className="text-lg font-semibold text-gray-700">Coming Soon</h2>
          <p className="text-sm text-gray-400 mt-1 max-w-md">
            Department analytics — patient volume charts, CTAS distribution, wait time trends,
            and staff metrics — will be available in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
