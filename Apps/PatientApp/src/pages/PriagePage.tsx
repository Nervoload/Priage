import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { GuestChatbotPage } from '../features/pre-triage/GuestChatbotPage';
import { Routing } from '../features/pre-triage/Routing';
import { updateIntakeDetails } from '../shared/api/intake';
import { friendlyError } from '../shared/api/errors';
import { useAuth } from '../shared/hooks/useAuth';
import { CtaButton } from '../shared/ui/Controls';
import { FieldHint, TextAreaField, TextField, focusFirstInvalid } from '../shared/ui/Field';
import { FlowScreen } from '../shared/ui/FlowScreen';
import { Icon } from '../shared/ui/Icon';

type IntakeStep = 'capture' | 'interview' | 'routing';

const COMPLAINT_LIMIT = 240;

export function PriagePage() {
  const navigate = useNavigate();
  const { patient } = useAuth();

  const [step, setStep] = useState<IntakeStep>('capture');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [details, setDetails] = useState('');
  const [contactEmail, setContactEmail] = useState(patient?.email ?? '');
  const [errors, setErrors] = useState<{ chiefComplaint?: string; contactEmail?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleStartInterview(event: React.FormEvent) {
    event.preventDefault();

    const trimmedChiefComplaint = chiefComplaint.trim();
    const trimmedDetails = details.trim();
    const nextErrors = {
      chiefComplaint: trimmedChiefComplaint ? undefined : 'Tell us the main reason for your visit.',
      contactEmail: contactEmail.trim() ? undefined : 'Enter an email for visit updates.',
    };
    setErrors(nextErrors);
    if (nextErrors.chiefComplaint || nextErrors.contactEmail) {
      focusFirstInvalid('new-visit-form');
      return;
    }

    setSubmitting(true);
    try {
      await updateIntakeDetails({
        contactEmail: contactEmail.trim(),
        chiefComplaint: trimmedChiefComplaint,
        details: trimmedDetails || undefined,
        firstName: patient?.firstName ?? undefined,
        lastName: patient?.lastName ?? undefined,
        age: patient?.age ?? undefined,
        allergies: patient?.allergies ?? undefined,
        conditions: patient?.conditions ?? undefined,
      });
      setStep('interview');
    } catch (error) {
      setErrors({ form: friendlyError(error, 'We couldn’t start this visit. Please try again.') });
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'interview') {
    return (
      <GuestChatbotPage
        mode="authenticated"
        onChooseHospital={() => setStep('routing')}
        onBack={() => setStep('capture')}
      />
    );
  }

  if (step === 'routing') {
    return (
      <Routing
        mode="authenticated"
        onConfirmed={(encounterId, clinicAlias) => navigate(clinicAlias ? `/clinic/${clinicAlias}/visits/${encounterId}` : `/encounters/${encounterId}/current`, clinicAlias ? { state: { assessmentReviewed: true } } : undefined)}
        onBack={() => setStep('interview')}
      />
    );
  }

  const displayName = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || patient?.email || 'Your account';
  const accountLine = [displayName, patient?.age != null ? `age ${patient.age}` : '', patient?.phone ?? ''].filter(Boolean).join(', ');
  const healthLine = [patient?.allergies ? `Allergies: ${patient.allergies}` : '', patient?.conditions ? `Conditions: ${patient.conditions}` : ''].filter(Boolean).join('. ');

  return (
    <FlowScreen
      title="New visit"
      counter="Step 1 of 3"
      progress={12}
      onBack={() => navigate('/')}
      label="Start a new visit"
      footer={(
        <CtaButton type="submit" form="new-visit-form" busy={submitting} disabled={submitting}>
          {submitting ? 'Starting…' : 'Start assessment'}
        </CtaButton>
      )}
    >
      <div className="stack stack--sm">
        <h1 className="display">What’s going on today?</h1>
        <p className="lede">We’ll attach this visit to your account and use the details you’ve saved.</p>
      </div>

      <div className="link-card link-card--static">
        <span className="tile__icon tile__icon--neutral"><Icon name="user" /></span>
        <span className="row__main">
          <span className="row__value">{accountLine}</span>
          {healthLine && <span className="small">{healthLine}</span>}
        </span>
        <Link to="/settings" className="text-btn" style={{ minHeight: 0 }}>Edit</Link>
      </div>

      <form id="new-visit-form" className="form" onSubmit={handleStartInterview} noValidate>
        {errors.form && (
          <p className="notice notice--danger" role="alert">
            <Icon name="alertCircle" size={18} />
            <span>{errors.form}</span>
          </p>
        )}
        <TextAreaField
          label="What’s the main reason for your visit?"
          value={chiefComplaint}
          onChange={(event) => setChiefComplaint(event.target.value.slice(0, COMPLAINT_LIMIT))}
          placeholder="For example: ankle injury, chest pain, shortness of breath"
          rows={3}
          autoFocus
          error={errors.chiefComplaint}
          count={`${chiefComplaint.length} / ${COMPLAINT_LIMIT}`}
        />
        <TextAreaField
          label="Anything else the care team should know?"
          optional
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="When it started, what makes it better or worse"
          maxLength={4000}
          rows={3}
        />
        <TextField
          label="Email for visit updates"
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          autoComplete="email"
          error={errors.contactEmail}
          hint={<FieldHint>We’ll only use this for this visit.</FieldHint>}
        />
      </form>

      <p className="safety-line">
        <Icon name="alertTriangle" size={18} />
        <span><strong>Emergency?</strong> Call 911 or go to the nearest emergency department.</span>
      </p>
    </FlowScreen>
  );
}
