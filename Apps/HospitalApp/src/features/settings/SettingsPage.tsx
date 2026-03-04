// HospitalApp/src/features/settings/SettingsPage.tsx
// Decorative settings page for demo purposes.

import { NavBar, type View } from '../../shared/ui/NavBar';

interface SettingsPageProps {
  onNavigate: (view: View) => void;
  onLogout: () => void;
  user: { email: string; role: string } | null;
}

const toggles = [
  { label: 'Push Notifications', description: 'Receive alerts for critical CTAS patients', on: true },
  { label: 'Sound Alerts', description: 'Play audio for new high-priority admissions', on: true },
  { label: 'Auto-Assign Triage', description: 'Automatically assign incoming patients to triage nurse', on: false },
  { label: 'Email Daily Summary', description: 'Send daily department summary to admin emails', on: false },
];

const integrations = [
  { name: 'EMR System', description: 'Connect to hospital Electronic Medical Records', status: 'disconnected', icon: '🏥' },
  { name: 'Lab Results', description: 'Real-time lab result integration', status: 'disconnected', icon: '🧪' },
  { name: 'PACS / Imaging', description: 'Radiology and imaging systems', status: 'disconnected', icon: '📷' },
  { name: 'Pharmacy', description: 'Pharmacy order management', status: 'disconnected', icon: '💊' },
];

const staff = [
  { name: 'admin@priage.dev', role: 'ADMIN' },
  { name: 'doctor@priage.dev', role: 'DOCTOR' },
  { name: 'nurse@priage.dev', role: 'NURSE' },
  { name: 'staff@priage.dev', role: 'STAFF' },
];

export function SettingsPage({ onNavigate, onLogout, user }: SettingsPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar currentView="settings" onNavigate={onNavigate} onLogout={onLogout} user={user} />

      <div className="p-6 max-w-[900px] mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Hospital configuration and preferences</p>
        </div>

        {/* General */}
        <Section title="General">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Hospital Name</label>
              <input
                type="text"
                defaultValue="Priage General Hospital"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-priage-300"
                readOnly
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Department</label>
              <input
                type="text"
                defaultValue="Emergency Department"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-priage-300"
                readOnly
              />
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <div className="space-y-4">
            {toggles.map((toggle) => (
              <div key={toggle.label} className="flex items-center justify-between py-1">
                <div>
                  <div className="text-sm font-medium text-gray-700">{toggle.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{toggle.description}</div>
                </div>
                <div
                  className={`
                    relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-not-allowed
                    ${toggle.on ? 'bg-priage-600' : 'bg-gray-300'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
                      ${toggle.on ? 'translate-x-4' : 'translate-x-0.5'}
                    `}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Staff Management */}
        <Section title="Staff Management">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Email</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Role</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.name} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-700 font-medium">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-priage-50 text-priage-600">
                        {s.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="mt-3 px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed" disabled>
            + Add Staff Member
          </button>
        </Section>

        {/* Integrations */}
        <Section title="Integrations">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {integrations.map((item) => (
              <div key={item.name} className="bg-white border border-gray-200 rounded-lg p-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-700">{item.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{item.description}</div>
                  </div>
                </div>
                <button className="px-2.5 py-1 text-[10px] font-semibold text-gray-400 bg-gray-100 rounded cursor-not-allowed" disabled>
                  Connect
                </button>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
        {title}
      </h2>
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        {children}
      </div>
    </div>
  );
}
