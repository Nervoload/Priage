import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { deletePatientAccount, submitPatientFeedback, updateProfile } from '../shared/api/auth';
import { useAuth } from '../shared/hooks/useAuth';
import type { PatientFeedbackType, PatientProfile } from '../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

interface ProfileDraft {
  firstName: string;
  lastName: string;
  phone: string;
  age: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  allergies: string;
  conditions: string;
  preferredLanguage: string;
}

const EMPTY_DRAFT: ProfileDraft = {
  firstName: '',
  lastName: '',
  phone: '',
  age: '',
  gender: '',
  heightCm: '',
  weightKg: '',
  allergies: '',
  conditions: '',
  preferredLanguage: '',
};

export function SettingsPage() {
  const navigate = useNavigate();
  const { patient, logout, clearSession, updatePatient } = useAuth();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackType, setFeedbackType] = useState<PatientFeedbackType>('feedback');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!patient) {
      return;
    }

    setDraft(buildDraft(patient));
    setDeleteEmail(patient.email);
  }, [patient]);

  const hasUnsavedChanges = useMemo(() => {
    if (!patient) {
      return false;
    }
    return JSON.stringify(buildDraft(patient)) !== JSON.stringify(draft);
  }, [draft, patient]);

  async function handleConfirmSave() {
    if (!patient) {
      return;
    }

    const validationMessage = validateDraft(draft);
    if (validationMessage) {
      showToast(validationMessage);
      return;
    }

    if (!confirmPassword.trim()) {
      showToast('Enter your password to confirm these changes.');
      return;
    }

    setSaving(true);
    try {
      const updatedProfile = await updateProfile({
        firstName: optionalText(draft.firstName),
        lastName: optionalText(draft.lastName),
        phone: optionalText(draft.phone),
        age: optionalNumber(draft.age),
        gender: optionalText(draft.gender),
        heightCm: optionalNumber(draft.heightCm),
        weightKg: optionalNumber(draft.weightKg),
        allergies: optionalText(draft.allergies),
        conditions: optionalText(draft.conditions),
        preferredLanguage: optionalText(draft.preferredLanguage),
        currentPassword: confirmPassword.trim(),
      });

      updatePatient(updatedProfile);
      setDraft(buildDraft(updatedProfile));
      setEditing(false);
      setSaveModalOpen(false);
      setConfirmPassword('');
      showToast('Account details updated.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save your profile changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitFeedback() {
    const trimmed = feedbackMessage.trim();
    if (!trimmed) {
      showToast('Add your feedback or bug report before submitting.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      await submitPatientFeedback({
        type: feedbackType,
        message: trimmed,
      });
      setFeedbackMessage('');
      showToast(feedbackType === 'bug' ? 'Bug report submitted.' : 'Feedback submitted.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not submit your feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  }

  async function handleDeleteAccount() {
    if (!patient) {
      return;
    }

    if (deleteEmail.trim().toLowerCase() !== patient.email.trim().toLowerCase()) {
      showToast('Enter the exact account email to confirm deletion.');
      return;
    }

    if (!deletePassword.trim()) {
      showToast('Enter your password to confirm account deletion.');
      return;
    }

    setDeleting(true);
    try {
      await deletePatientAccount({
        email: deleteEmail.trim(),
        password: deletePassword,
      });
      clearSession();
      navigate('/welcome', { replace: true });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete your account.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      clearSession();
    } finally {
      setLoggingOut(false);
    }
  }

  function handleCancelEditing() {
    if (patient) {
      setDraft(buildDraft(patient));
    }
    setEditing(false);
    setConfirmPassword('');
    setSaveModalOpen(false);
  }

  if (!patient) {
    return null;
  }

  const displayName = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient';

  return (
    <>
      <main style={styles.page}>
        <section style={styles.container}>
          <header style={styles.headerCard}>
            <div style={styles.badge}>Settings</div>
            <h1 style={styles.title}>Account, preferences, and support</h1>
            <p style={styles.subtitle}>
              Manage your profile, leave patient-app feedback, and control your account access from one place.
            </p>
          </header>

          <section style={styles.sectionCard}>
            <div style={styles.profileHeader}>
              <div style={styles.avatar}>
                {(patient.firstName?.[0] ?? patient.email[0] ?? '?').toUpperCase()}
              </div>
              <div style={styles.profileSummary}>
                <p style={styles.profileName}>{displayName}</p>
                <p style={styles.profileMeta}>{patient.email}</p>
                <p style={styles.profileMeta}>Member since {new Date(patient.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div style={styles.sectionHeaderRow}>
              <div>
                <h2 style={styles.sectionTitle}>Account Details</h2>
                <p style={styles.sectionBody}>
                  Keep your patient details current. Saving changes requires your password.
                </p>
              </div>
              {!editing ? (
                <button type="button" style={styles.secondaryButton} onClick={() => setEditing(true)}>
                  Edit Details
                </button>
              ) : null}
            </div>

            {editing ? (
              <>
                <div style={styles.twoColumn}>
                  <Field label="First Name" value={draft.firstName} onChange={(value) => setDraft((current) => ({ ...current, firstName: value }))} />
                  <Field label="Last Name" value={draft.lastName} onChange={(value) => setDraft((current) => ({ ...current, lastName: value }))} />
                </div>
                <Field label="Phone" value={draft.phone} onChange={(value) => setDraft((current) => ({ ...current, phone: value }))} type="tel" />
                <div style={styles.twoColumn}>
                  <Field label="Age" value={draft.age} onChange={(value) => setDraft((current) => ({ ...current, age: value }))} type="number" />
                  <Field label="Gender" value={draft.gender} onChange={(value) => setDraft((current) => ({ ...current, gender: value }))} />
                </div>
                <div style={styles.twoColumn}>
                  <Field label="Height (cm)" value={draft.heightCm} onChange={(value) => setDraft((current) => ({ ...current, heightCm: value }))} type="number" />
                  <Field label="Weight (kg)" value={draft.weightKg} onChange={(value) => setDraft((current) => ({ ...current, weightKg: value }))} type="number" />
                </div>
                <Field label="Allergies" value={draft.allergies} onChange={(value) => setDraft((current) => ({ ...current, allergies: value }))} multiline rows={3} />
                <Field label="Conditions" value={draft.conditions} onChange={(value) => setDraft((current) => ({ ...current, conditions: value }))} multiline rows={3} />
                <Field label="Preferred Language" value={draft.preferredLanguage} onChange={(value) => setDraft((current) => ({ ...current, preferredLanguage: value }))} />
                <div style={styles.actionRow}>
                  <button type="button" style={styles.secondaryButton} onClick={handleCancelEditing}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={() => setSaveModalOpen(true)}
                    disabled={!hasUnsavedChanges}
                  >
                    Save Details
                  </button>
                </div>
              </>
            ) : (
              <div style={styles.detailGrid}>
                <DetailItem label="First Name" value={patient.firstName} />
                <DetailItem label="Last Name" value={patient.lastName} />
                <DetailItem label="Phone" value={patient.phone} />
                <DetailItem label="Age" value={patient.age != null ? String(patient.age) : null} />
                <DetailItem label="Gender" value={patient.gender} />
                <DetailItem label="Height" value={patient.heightCm != null ? `${patient.heightCm} cm` : null} />
                <DetailItem label="Weight" value={patient.weightKg != null ? `${patient.weightKg} kg` : null} />
                <DetailItem label="Allergies" value={patient.allergies} />
                <DetailItem label="Conditions" value={patient.conditions} />
                <DetailItem label="Preferred Language" value={patient.preferredLanguage} />
              </div>
            )}
          </section>

          <section style={styles.sectionCard}>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h2 style={styles.sectionTitle}>Feedback and Bug Reports</h2>
                <p style={styles.sectionBody}>
                  Tell us what is working well or what needs attention in the patient app.
                </p>
              </div>
            </div>

            <div style={styles.segmentedControl}>
              <button
                type="button"
                style={{ ...styles.segmentButton, ...(feedbackType === 'feedback' ? styles.segmentButtonActive : null) }}
                onClick={() => setFeedbackType('feedback')}
              >
                Feedback
              </button>
              <button
                type="button"
                style={{ ...styles.segmentButton, ...(feedbackType === 'bug' ? styles.segmentButtonActive : null) }}
                onClick={() => setFeedbackType('bug')}
              >
                Report a Bug
              </button>
            </div>

            <label style={styles.fieldLabel}>
              {feedbackType === 'bug' ? 'Describe the issue' : 'Share your feedback'}
              <textarea
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                rows={5}
                style={styles.textarea}
                placeholder={feedbackType === 'bug' ? 'What happened, and what were you trying to do?' : 'Tell us what would improve your patient experience.'}
              />
            </label>

            <div style={styles.actionRow}>
              <button type="button" style={styles.primaryButton} onClick={() => void handleSubmitFeedback()} disabled={submittingFeedback}>
                {submittingFeedback ? 'Submitting…' : feedbackType === 'bug' ? 'Submit Bug Report' : 'Submit Feedback'}
              </button>
            </div>
          </section>

          <section style={styles.dangerCard}>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h2 style={styles.sectionTitle}>Account Access</h2>
                <p style={styles.sectionBody}>
                  Log out on this device, or permanently remove this account from patient-app access.
                </p>
              </div>
            </div>

            <div style={styles.actionRow}>
              <button type="button" style={styles.secondaryButton} onClick={() => navigate('/priage')}>
                Start New Visit
              </button>
              <button type="button" style={styles.secondaryButton} onClick={() => void handleLogout()} disabled={loggingOut}>
                {loggingOut ? 'Logging out…' : 'Log Out'}
              </button>
              <button
                type="button"
                style={styles.dangerButton}
                onClick={() => {
                  setDeleteEmail(patient.email);
                  setDeletePassword('');
                  setDeleteModalOpen(true);
                }}
              >
                Delete Account
              </button>
            </div>
          </section>
        </section>
      </main>

      <SettingsModal
        open={saveModalOpen}
        title="Confirm profile changes"
        description="Enter your password to save the updated account details."
        onClose={() => {
          if (!saving) {
            setSaveModalOpen(false);
            setConfirmPassword('');
          }
        }}
      >
        <Field label="Password" value={confirmPassword} onChange={setConfirmPassword} type="password" />
        <div style={styles.modalActions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => {
              setSaveModalOpen(false);
              setConfirmPassword('');
            }}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="button" style={styles.primaryButton} onClick={() => void handleConfirmSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Confirm and Save'}
          </button>
        </div>
      </SettingsModal>

      <SettingsModal
        open={deleteModalOpen}
        title="Delete this account"
        description="Enter your email and password to remove patient-app access. Existing clinic visit records are retained."
        onClose={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
          }
        }}
      >
        <Field label="Email" value={deleteEmail} onChange={setDeleteEmail} type="email" />
        <Field label="Password" value={deletePassword} onChange={setDeletePassword} type="password" />
        <div style={styles.modalActions}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => {
              setDeleteModalOpen(false);
              setDeletePassword('');
            }}
            disabled={deleting}
          >
            Cancel
          </button>
          <button type="button" style={styles.dangerButton} onClick={() => void handleDeleteAccount()} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete Account'}
          </button>
        </div>
      </SettingsModal>
    </>
  );
}

function SettingsModal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>{title}</h2>
            <p style={styles.modalDescription}>{description}</p>
          </div>
          <button type="button" style={styles.modalCloseButton} onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        <div style={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={styles.detailItem}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value?.trim() ? value : 'Not provided'}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <label style={styles.fieldLabel}>
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          style={styles.textarea}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={styles.input}
        />
      )}
    </label>
  );
}

function buildDraft(patient: PatientProfile): ProfileDraft {
  return {
    firstName: patient.firstName ?? '',
    lastName: patient.lastName ?? '',
    phone: patient.phone ?? '',
    age: patient.age != null ? String(patient.age) : '',
    gender: patient.gender ?? '',
    heightCm: patient.heightCm != null ? String(patient.heightCm) : '',
    weightKg: patient.weightKg != null ? String(patient.weightKg) : '',
    allergies: patient.allergies ?? '',
    conditions: patient.conditions ?? '',
    preferredLanguage: patient.preferredLanguage ?? '',
  };
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function validateDraft(draft: ProfileDraft): string | null {
  const numericFields: Array<[string, string]> = [
    ['age', draft.age],
    ['height', draft.heightCm],
    ['weight', draft.weightKg],
  ];

  for (const [label, value] of numericFields) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return `Enter a valid ${label} value before saving.`;
    }
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: 'calc(100vh - 64px)',
    padding: '1rem 1rem 2rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
  },
  container: {
    maxWidth: '760px',
    margin: '0 auto',
    display: 'grid',
    gap: '1rem',
  },
  headerCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.panel,
    padding: '1rem',
    display: 'grid',
    gap: '0.35rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    border: panelBorder,
    borderRadius: '999px',
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.26rem 0.72rem',
    fontSize: '0.74rem',
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.28rem',
  },
  subtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.5,
  },
  sectionCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.panel,
    padding: '1rem',
    display: 'grid',
    gap: '0.9rem',
  },
  dangerCard: {
    border: '1px solid #fecaca',
    borderRadius: patientTheme.radius.lg,
    background: '#fff7f8',
    boxShadow: patientTheme.shadows.card,
    padding: '1rem',
    display: 'grid',
    gap: '0.9rem',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    flexWrap: 'wrap',
  },
  avatar: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1949b8 0%, #3b82f6 100%)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '1.1rem',
  },
  profileSummary: {
    display: 'grid',
    gap: '0.2rem',
  },
  profileName: {
    margin: 0,
    fontWeight: 700,
    fontSize: '0.98rem',
  },
  profileMeta: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.82rem',
  },
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1rem',
  },
  sectionBody: {
    margin: '0.25rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.5,
    fontSize: '0.9rem',
  },
  detailGrid: {
    display: 'grid',
    gap: '0.75rem',
  },
  detailItem: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    padding: '0.8rem 0.85rem',
    display: 'grid',
    gap: '0.18rem',
  },
  detailLabel: {
    fontSize: '0.76rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: patientTheme.colors.inkMuted,
    fontWeight: 700,
  },
  detailValue: {
    fontSize: '0.94rem',
    color: patientTheme.colors.ink,
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.65rem',
  },
  fieldLabel: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  input: {
    width: '100%',
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.72rem 0.78rem',
    fontSize: '0.94rem',
    fontFamily: patientTheme.fonts.body,
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.78rem',
    fontSize: '0.94rem',
    fontFamily: patientTheme.fonts.body,
    lineHeight: 1.5,
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  segmentedControl: {
    display: 'inline-flex',
    width: 'fit-content',
    border: panelBorder,
    borderRadius: '999px',
    padding: '0.2rem',
    background: '#f8fafc',
    gap: '0.25rem',
  },
  segmentButton: {
    border: 'none',
    borderRadius: '999px',
    background: 'transparent',
    color: patientTheme.colors.inkMuted,
    padding: '0.52rem 0.9rem',
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    cursor: 'pointer',
  },
  segmentButtonActive: {
    background: '#1d4ed8',
    color: '#fff',
  },
  actionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.6rem',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.78rem 1rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.78rem 1rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  dangerButton: {
    border: '1px solid #fca5a5',
    borderRadius: patientTheme.radius.sm,
    background: '#fee2e2',
    color: '#991b1b',
    padding: '0.78rem 1rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    background: 'rgba(15, 23, 42, 0.34)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modalCard: {
    width: 'min(92vw, 520px)',
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    boxShadow: '0 30px 70px rgba(15, 23, 42, 0.26)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    padding: '1rem 1rem 0.8rem',
    borderBottom: panelBorder,
  },
  modalTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.04rem',
  },
  modalDescription: {
    margin: '0.3rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.5,
    fontSize: '0.88rem',
  },
  modalCloseButton: {
    border: 'none',
    background: 'transparent',
    color: patientTheme.colors.inkMuted,
    fontSize: '1.5rem',
    lineHeight: 1,
    cursor: 'pointer',
  },
  modalBody: {
    display: 'grid',
    gap: '0.9rem',
    padding: '1rem',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: '0.6rem',
  },
};
