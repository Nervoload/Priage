import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { deletePatientAccount, submitPatientFeedback, updateProfile } from '../shared/api/auth';
import { getDeleteAccountConfirmationError } from '../shared/deleteAccountConfirmation';
import { useAuth } from '../shared/hooks/useAuth';
import type { PatientFeedbackType, PatientProfile } from '../shared/types/domain';
import { initialsFor } from '../app/AppShell';
import { friendlyError } from '../shared/api/errors';
import { Modal } from '../shared/ui/Controls';
import { cx } from '../shared/ui/cx';
import { TextAreaField, TextField } from '../shared/ui/Field';
import { Icon } from '../shared/ui/Icon';
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
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!patient) {
      return;
    }

    setDraft(buildDraft(patient));
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
      showToast('Enter your password to save these changes.');
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
      showToast('Your details are saved.', 'success');
    } catch (error) {
      showToast(friendlyError(error, 'We couldn’t save your changes. Check your password and try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitFeedback() {
    const trimmed = feedbackMessage.trim();
    if (!trimmed) {
      showToast('Write a few words before sending.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      await submitPatientFeedback({
        type: feedbackType,
        message: trimmed,
      });
      setFeedbackMessage('');
      showToast(feedbackType === 'bug' ? 'Thanks — we’ve logged the problem.' : 'Thanks for the feedback.', 'success');
    } catch (error) {
      showToast(friendlyError(error, 'We couldn’t send that. Please try again.'));
    } finally {
      setSubmittingFeedback(false);
    }
  }

  async function handleDeleteAccount() {
    if (!patient) {
      return;
    }

    const confirmationError = getDeleteAccountConfirmationError(patient.email, deleteEmail, deletePassword, deleteAcknowledged);
    if (confirmationError) {
      showToast(confirmationError);
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
      showToast(friendlyError(error, 'We couldn’t delete your account. Check your details and try again.'));
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
  const deleteError = getDeleteAccountConfirmationError(patient.email, deleteEmail, deletePassword, deleteAcknowledged);
  const setField = (key: keyof ProfileDraft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  return (
    <>
      <main id="main" className="page">
        <header className="page__header">
          <h1 className="display">Account</h1>
          <p className="lede">Your details, feedback and account access.</p>
        </header>

        <section className="card card--pad" aria-label="Profile">
          <div className="cluster" style={{ '--cluster-gap': '16px', flexWrap: 'nowrap' } as React.CSSProperties}>
            <span className="avatar avatar--lg" aria-hidden="true">{initialsFor(patient.firstName, patient.lastName, patient.email)}</span>
            <div className="stack stack--xs" style={{ minWidth: 0 }}>
              <span className="title">{displayName}</span>
              <span className="small" style={{ overflowWrap: 'anywhere' }}>{patient.email}</span>
              <span className="small">Member since {new Date(patient.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="details-title">
          <div className="card__head">
            <h2 id="details-title" className="heading" style={{ flex: 1 }}>Your details</h2>
            {!editing && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}>
                <Icon name="edit" size={16} />
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="form" style={{ padding: 20 }}>
              <p className="body">Saving changes asks for your password.</p>
              <div className="field__row">
                <TextField label="First name" value={draft.firstName} onChange={setField('firstName')} autoComplete="given-name" />
                <TextField label="Last name" value={draft.lastName} onChange={setField('lastName')} autoComplete="family-name" />
              </div>
              <TextField label="Phone" type="tel" value={draft.phone} onChange={setField('phone')} autoComplete="tel" />
              <div className="field__row">
                <TextField label="Age" inputMode="numeric" value={draft.age} onChange={setField('age')} />
                <TextField label="Gender" value={draft.gender} onChange={setField('gender')} />
              </div>
              <div className="field__row">
                <TextField label="Height (cm)" inputMode="decimal" value={draft.heightCm} onChange={setField('heightCm')} />
                <TextField label="Weight (kg)" inputMode="decimal" value={draft.weightKg} onChange={setField('weightKg')} />
              </div>
              <TextAreaField label="Allergies" rows={2} value={draft.allergies} onChange={setField('allergies')} />
              <TextAreaField label="Conditions" rows={2} value={draft.conditions} onChange={setField('conditions')} />
              <TextField label="Preferred language" value={draft.preferredLanguage} onChange={setField('preferredLanguage')} />
              <div className="cluster" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn--quiet" onClick={handleCancelEditing}>Cancel</button>
                <button type="button" className="btn btn--primary" onClick={() => setSaveModalOpen(true)} disabled={!hasUnsavedChanges}>
                  Save changes
                </button>
              </div>
            </div>
          ) : (
            <div className="detail-grid">
              <DetailItem label="First name" value={patient.firstName} />
              <DetailItem label="Last name" value={patient.lastName} />
              <DetailItem label="Phone" value={patient.phone} />
              <DetailItem label="Age" value={patient.age != null ? String(patient.age) : null} />
              <DetailItem label="Gender" value={patient.gender} />
              <DetailItem label="Preferred language" value={patient.preferredLanguage} />
              <DetailItem label="Height" value={patient.heightCm != null ? `${patient.heightCm} cm` : null} />
              <DetailItem label="Weight" value={patient.weightKg != null ? `${patient.weightKg} kg` : null} />
              <DetailItem label="Allergies" value={patient.allergies} />
              <DetailItem label="Conditions" value={patient.conditions} />
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="feedback-title">
          <div className="card__head">
            <h2 id="feedback-title" className="heading">Help us improve Priage</h2>
          </div>
          <div className="form" style={{ padding: 20 }}>
            <div className="seg" role="group" aria-label="Feedback type" style={{ alignSelf: 'flex-start' }}>
              <button type="button" aria-pressed={feedbackType === 'feedback'} onClick={() => setFeedbackType('feedback')}>Feedback</button>
              <button type="button" aria-pressed={feedbackType === 'bug'} onClick={() => setFeedbackType('bug')}>Report a problem</button>
            </div>
            <TextAreaField
              label={feedbackType === 'bug' ? 'What went wrong?' : 'What would make Priage better?'}
              rows={4}
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              placeholder={feedbackType === 'bug' ? 'What happened, and what were you trying to do?' : 'Tell us what worked and what didn’t.'}
              hint="Please don’t include medical details here — message your care team instead."
            />
            <div>
              <button type="button" className="btn btn--secondary" onClick={() => void handleSubmitFeedback()} disabled={submittingFeedback || !feedbackMessage.trim()}>
                {submittingFeedback ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </section>

        <section className="card" aria-label="Account access">
          <div className="rows">
            <button type="button" className="row row--link" onClick={() => void handleLogout()} disabled={loggingOut} style={{ width: '100%', border: 0, borderBottom: '1px solid var(--line)', background: 'transparent', textAlign: 'left' }}>
              <Icon name="logout" />
              <span className="row__main"><span className="row__value">{loggingOut ? 'Signing out…' : 'Sign out'}</span></span>
            </button>
            <button
              type="button"
              className="row row--link"
              style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', color: 'var(--red)' }}
              onClick={() => {
                setDeleteEmail('');
                setDeletePassword('');
                setDeleteAcknowledged(false);
                setDeleteModalOpen(true);
              }}
            >
              <Icon name="trash" />
              <span className="row__main"><span className="row__value">Delete account</span></span>
            </button>
          </div>
        </section>
      </main>

      <Modal
        open={saveModalOpen}
        title="Confirm your changes"
        description="Enter your password to save your updated details."
        dismissible={!saving}
        onClose={() => {
          setSaveModalOpen(false);
          setConfirmPassword('');
        }}
      >
        <form className="form" onSubmit={(event) => { event.preventDefault(); void handleConfirmSave(); }}>
          <TextField label="Password" type="password" autoComplete="current-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <div className="modal__actions">
            <button type="button" className="btn btn--quiet" onClick={() => { setSaveModalOpen(false); setConfirmPassword(''); }} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving || !confirmPassword.trim()}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteModalOpen}
        title="Delete your account?"
        description="This can’t be undone. You’ll lose app access right away. Clinic visit records stay with the clinic under its retention policy."
        dismissible={!deleting}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteEmail('');
          setDeletePassword('');
          setDeleteAcknowledged(false);
        }}
      >
        <form className="form" onSubmit={(event) => { event.preventDefault(); void handleDeleteAccount(); }}>
          <label className="check">
            <input type="checkbox" checked={deleteAcknowledged} onChange={(event) => setDeleteAcknowledged(event.target.checked)} />
            <span>I understand that deleting my account can’t be undone.</span>
          </label>
          <TextField label="Type your account email" type="email" autoComplete="off" value={deleteEmail} onChange={(event) => setDeleteEmail(event.target.value)} hint={patient.email} />
          <TextField label="Password" type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
          <div className="modal__actions">
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteEmail('');
                setDeletePassword('');
                setDeleteAcknowledged(false);
              }}
              disabled={deleting}
            >
              Keep my account
            </button>
            <button type="submit" className="btn btn--danger" disabled={deleting || deleteError !== null}>
              {deleting ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  const filled = !!value?.trim();
  return (
    <div className="row">
      <span className="row__main">
        <span className="row__key">{label}</span>
        <span className={cx('row__value', !filled && 'row__value--empty')}>{filled ? value : 'Not added'}</span>
      </span>
    </div>
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
