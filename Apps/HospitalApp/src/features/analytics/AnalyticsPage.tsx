// HospitalApp/src/features/analytics/AnalyticsPage.tsx
// Decorative analytics dashboard for demo purposes.

import { NavBar, type View } from '../../shared/ui/NavBar';

interface AnalyticsPageProps {
  onNavigate: (view: View) => void;
  onLogout: () => void;
  user: { email: string; role: string } | null;
}

const statCards = [
  { label: 'Avg Wait Time', value: '34 min', change: '-8%', positive: true, icon: '⏱' },
  { label: 'Patients Today', value: '47', change: '+12%', positive: true, icon: '👥' },
  { label: 'CTAS 1–2 Rate', value: '12%', change: '+2%', positive: false, icon: '🚨' },
  { label: 'Bed Utilization', value: '73%', change: '+5%', positive: true, icon: '🛏' },
];

export function AnalyticsPage({ onNavigate, onLogout, user }: AnalyticsPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar currentView="analytics" onNavigate={onNavigate} onLogout={onLogout} user={user} />

      <div className="p-6 max-w-[1200px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Department Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Emergency Department — Real-time overview</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed" disabled>
              Date Range ▾
            </button>
            <button className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed" disabled>
              Export Report
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{card.icon}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  card.positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {card.change}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-xs text-gray-500 mt-1">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Patient Volume (24h)</h3>
              <div className="flex gap-1">
                <button className="px-2 py-1 text-[10px] bg-priage-50 text-priage-600 rounded font-medium cursor-not-allowed" disabled>Hour</button>
                <button className="px-2 py-1 text-[10px] bg-gray-100 text-gray-400 rounded font-medium cursor-not-allowed" disabled>Day</button>
                <button className="px-2 py-1 text-[10px] bg-gray-100 text-gray-400 rounded font-medium cursor-not-allowed" disabled>Week</button>
              </div>
            </div>
            {/* Shimmer chart placeholder */}
            <div className="h-56 rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-shimmer flex items-center justify-center">
              <span className="text-sm text-gray-300 font-medium">Chart visualization</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">CTAS Distribution</h3>
            <div className="space-y-3">
              {[
                { level: 1, label: 'Resuscitation', pct: 3, color: 'bg-ctas-1' },
                { level: 2, label: 'Emergent', pct: 9, color: 'bg-ctas-2' },
                { level: 3, label: 'Urgent', pct: 38, color: 'bg-ctas-3' },
                { level: 4, label: 'Less Urgent', pct: 35, color: 'bg-ctas-4' },
                { level: 5, label: 'Non-Urgent', pct: 15, color: 'bg-ctas-5' },
              ].map((item) => (
                <div key={item.level}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">CTAS {item.level} — {item.label}</span>
                    <span className="text-gray-400 font-semibold">{item.pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Additional cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Chief Complaints</h3>
            <div className="space-y-2">
              {['Chest Pain', 'Abdominal Pain', 'Laceration', 'Headache/Migraine', 'Shortness of Breath'].map((complaint, i) => (
                <div key={complaint} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                    <span className="text-sm text-gray-700">{complaint}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-400">{[12, 9, 7, 6, 5][i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Staff On Duty</h3>
            <div className="space-y-2">
              {[
                { name: 'Dr. Williams', role: 'DOCTOR', status: 'Active' },
                { name: 'Nurse Thompson', role: 'NURSE', status: 'Active' },
                { name: 'Nurse Garcia', role: 'NURSE', status: 'Break' },
                { name: 'Admin Patel', role: 'ADMIN', status: 'Active' },
              ].map((staff) => (
                <div key={staff.name} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-priage-100 text-priage-600 flex items-center justify-center text-[10px] font-bold">
                      {staff.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-sm text-gray-700 font-medium">{staff.name}</div>
                      <div className="text-[10px] text-gray-400 uppercase">{staff.role}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    staff.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {staff.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
