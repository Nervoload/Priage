import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { updateProfile } from '../shared/api/auth';
import { useAuth } from '../shared/hooks/useAuth';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

export function SettingsPage() {
  const navigate = useNavigate();
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
      showToast('Profile updated.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // Auth context will still clear local session state.
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.container}>
        <header style={styles.header}>
          <span style={styles.badge}>Profile</span>
          <h1 style={styles.title}>Patient information and settings</h1>
        </header>

        <article style={styles.profileCard}>
          <div style={styles.avatar}>
            {(patient?.firstName?.[0] ?? patient?.email?.[0] ?? '?').toUpperCase()}
          </div>
          <div>
            <p style={styles.profileName}>
              {[patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || 'Patient'}
            </p>
            <p style={styles.profileEmail}>{patient?.email}</p>
          </div>
        </article>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Personal</h2>
          <div style={styles.twoCol}>
            <Field label="First Name" value={firstName} onChange={setFirstName} />
            <Field label="Last Name" value={lastName} onChange={setLastName} />
          </div>
          <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
          <div style={styles.twoCol}>
            <Field label="Age" value={age} onChange={setAge} type="number" />
            <label style={styles.fieldLabel}>
              Gender
              <select value={gender} onChange={(event) => setGender(event.target.value)} style={styles.input}>
                <option value="">—</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Health</h2>
          <div style={styles.twoCol}>
            <Field label="Height (cm)" value={heightCm} onChange={setHeightCm} type="number" />
            <Field label="Weight (kg)" value={weightKg} onChange={setWeightKg} type="number" />
          </div>
          <Field label="Allergies" value={allergies} onChange={setAllergies} />
          <Field label="Conditions" value={conditions} onChange={setConditions} />
          <Field label="Preferred Language" value={preferredLanguage} onChange={setPreferredLanguage} />
        </section>

        <section style={styles.actionRow}>
          <button style={styles.primaryButton} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button style={styles.secondaryButton} onClick={() => navigate('/priage')}>
            Start new visit
          </button>
        </section>

        <button style={styles.logoutButton} onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label style={styles.fieldLabel}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={styles.input}
      />
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: 'calc(100vh - 72px)',
    padding: '1.15rem 1rem 6rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
  },
  container: {
    maxWidth: '760px',
    margin: '0 auto',
    display: 'grid',
    gap: '0.82rem',
  },
  header: {
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: 'rgba(255, 253, 248, 0.98)',
    padding: '0.95rem',
    display: 'grid',
    gap: '0.38rem',
    boxShadow: '0 20px 48px -40px rgba(20,33,61,0.38)',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    border: panelBorder,
    borderRadius: '999px',
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.34rem 0.78rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.4rem',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.88rem',
  },
  presetRow: {
    display: 'flex',
    gap: '0.45rem',
    flexWrap: 'wrap',
  },
  profileCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    padding: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.72rem',
    boxShadow: '0 18px 40px -34px rgba(20,33,61,0.36)',
  },
  avatar: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1949b8 0%, #3b82f6 100%)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
  },
  profileName: {
    margin: 0,
    fontWeight: 700,
    fontSize: '0.98rem',
  },
  profileEmail: {
    margin: '0.15rem 0 0',
    color: patientTheme.colors.inkMuted,
    fontSize: '0.78rem',
  },
  section: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    padding: '0.88rem',
    display: 'grid',
    gap: '0.58rem',
    boxShadow: '0 18px 40px -34px rgba(20,33,61,0.34)',
  },
  sectionTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '0.82rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: patientTheme.colors.inkMuted,
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.58rem',
  },
  fieldLabel: {
    display: 'grid',
    gap: '0.28rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  input: {
    width: '100%',
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.72rem 0.78rem',
    fontSize: '0.9rem',
    fontFamily: patientTheme.fonts.body,
    boxSizing: 'border-box',
    boxShadow: '0 10px 24px -22px rgba(20,33,61,0.5)',
  },
  actionRow: {
    display: 'flex',
    gap: '0.56rem',
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.78rem 0.96rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 18px 36px -24px rgba(25,73,184,0.72)',
    transition: 'all 0.18s ease',
    fontFamily: patientTheme.fonts.body,
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.78rem 0.96rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    fontFamily: patientTheme.fonts.body,
  },
  logoutButton: {
    border: '1px solid #fecaca',
    borderRadius: patientTheme.radius.sm,
    background: '#fff1f2',
    color: '#9f1239',
    padding: '0.76rem 0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    fontFamily: patientTheme.fonts.body,
  },
};
