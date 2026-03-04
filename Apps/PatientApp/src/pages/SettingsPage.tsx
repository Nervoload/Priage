// Settings page — profile editing + logout.

import { useState, useEffect } from 'react';
import { useAuth } from '../shared/hooks/useAuth';
import { updateProfile } from '../shared/api/auth';
import { useToast } from '../shared/ui/ToastContext';

export function SettingsPage() {
  const { patient, logout, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Populate from current patient profile
  useEffect(() => {
    if (!patient) return;
    setFirstName(patient.firstName ?? '');
    setLastName(patient.lastName ?? '');
    setPhone(patient.phone ?? '');
    setAge(patient.age != null ? String(patient.age) : '');
    setGender(patient.gender ?? '');
    setHeightCm(patient.heightCm != null ? String(patient.heightCm) : '');
    setWeightKg(patient.weightKg != null ? String(patient.weightKg) : '');
    setAllergies(patient.allergies ?? '');
    setConditions(patient.conditions ?? '');
    setPreferredLanguage(patient.preferredLanguage ?? '');
  }, [patient]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        age: age ? Number(age) : undefined,
        gender: gender || undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        allergies: allergies || undefined,
        conditions: conditions || undefined,
        preferredLanguage: preferredLanguage || undefined,
      });
      await refreshProfile();
      showToast('Profile updated!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // even if API fails, auth context clears local state
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>Settings</h2>

      {/* Profile card */}
      <div style={styles.profileCard}>
        <div style={styles.avatar}>
          {(patient?.firstName?.[0] ?? patient?.email?.[0] ?? '?').toUpperCase()}
        </div>
        <div>
          <p style={styles.profileName}>
            {[patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || 'Patient'}
          </p>
          <p style={styles.profileEmail}>{patient?.email}</p>
        </div>
      </div>

      {/* Form */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Personal Information</h3>

        <div style={styles.row}>
          <Field label="First Name" value={firstName} onChange={setFirstName} />
          <Field label="Last Name" value={lastName} onChange={setLastName} />
        </div>
        <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
        <div style={styles.row}>
          <Field label="Age" value={age} onChange={setAge} type="number" />
          <div style={styles.fieldWrap}>
            <label style={styles.label}>Gender</label>
            <select
              value={gender}
              onChange={e => setGender(e.target.value)}
              style={styles.input}
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Health Information</h3>

        <div style={styles.row}>
          <Field label="Height (cm)" value={heightCm} onChange={setHeightCm} type="number" />
          <Field label="Weight (kg)" value={weightKg} onChange={setWeightKg} type="number" />
        </div>
        <Field label="Allergies" value={allergies} onChange={setAllergies} placeholder="e.g. Penicillin, Peanuts" />
        <Field label="Conditions" value={conditions} onChange={setConditions} placeholder="e.g. Asthma, Diabetes" />
        <Field label="Preferred Language" value={preferredLanguage} onChange={setPreferredLanguage} placeholder="e.g. English" />
      </div>

      {/* Save */}
      <button
        style={styles.saveBtn}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>

      {/* Logout */}
      <button
        style={styles.logoutBtn}
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? 'Logging out…' : 'Log Out'}
      </button>

      <p style={styles.version}>Priage Patient App v1.0.0</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '500px',
    margin: '0 auto',
    padding: '1rem 1rem 6rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  pageTitle: {
    fontSize: '1.35rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 1rem',
  },
  profileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '1rem',
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #f1f5f9',
    marginBottom: '1.25rem',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1e3a5f, #3b82f6)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  profileName: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  profileEmail: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    margin: '0.1rem 0 0',
  },
  section: {
    marginBottom: '1.25rem',
  },
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: '#94a3b8',
    margin: '0 0 0.6rem',
  },
  row: {
    display: 'flex',
    gap: '0.5rem',
  },
  fieldWrap: {
    flex: 1,
    marginBottom: '0.5rem',
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#475569',
    marginBottom: '0.2rem',
  },
  input: {
    width: '100%',
    padding: '0.55rem 0.7rem',
    border: '2px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '0.88rem',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    background: '#fff',
  },
  saveBtn: {
    width: '100%',
    padding: '0.8rem',
    background: '#1e3a5f',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: '0.75rem',
    fontFamily: 'inherit',
  },
  logoutBtn: {
    width: '100%',
    padding: '0.75rem',
    background: '#fff',
    color: '#dc2626',
    border: '2px solid #fecaca',
    borderRadius: '14px',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  version: {
    textAlign: 'center',
    color: '#cbd5e1',
    fontSize: '0.72rem',
    marginTop: '1.5rem',
  },
};
