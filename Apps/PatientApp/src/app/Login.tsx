import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { createIntent } from '../shared/api/intake';
import { friendlyError } from '../shared/api/errors';
import { useGuestSession } from '../shared/hooks/useGuestSession';
import { CtaButton } from '../shared/ui/Controls';
import { FieldHint, SelectField, TextAreaField, TextField, focusFirstInvalid } from '../shared/ui/Field';
import { FlowScreen } from '../shared/ui/FlowScreen';
import { Icon } from '../shared/ui/Icon';

export type VisitStartDetails = {
  firstName: string; lastName?: string; phone?: string; contactEmail: string;
  age?: number; gender?: string; chiefComplaint: string; details?: string;
};

type StartErrors = Partial<Record<'firstName' | 'phone' | 'contactEmail' | 'age' | 'gender' | 'chiefComplaint' | 'form', string>>;

const COMPLAINT_LIMIT = 240;

export function Login({ clinic }: { clinic?: {
  name: string; bookingAvailable: boolean; account: boolean; authActions: ReactNode;
  initialDetails?: Partial<VisitStartDetails>;
  onStart: (details: VisitStartDetails) => Promise<void>;
} } = {}) {
  const navigate = useNavigate();
  const { setSession } = useGuestSession();

  const [firstName, setFirstName] = useState(clinic?.initialDetails?.firstName ?? '');
  const [lastName, setLastName] = useState(clinic?.initialDetails?.lastName ?? '');
  const [phone, setPhone] = useState(clinic?.initialDetails?.phone ?? '');
  const [contactEmail, setContactEmail] = useState(clinic?.initialDetails?.contactEmail ?? '');
  const [age, setAge] = useState(clinic?.initialDetails?.age?.toString() ?? '');
  const [gender, setGender] = useState(clinic?.initialDetails?.gender ?? '');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState<StartErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const isClinic = !!clinic;
  const usesAccount = !!clinic?.account;

  function validate(): StartErrors {
    const next: StartErrors = {};
    if (!usesAccount && !firstName.trim()) next.firstName = 'Enter your first name.';
    if (!isClinic && !phone.trim()) next.phone = 'Enter a phone number the care team can reach.';
    if (!contactEmail.trim()) next.contactEmail = 'Enter an email for visit updates.';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim())) next.contactEmail = 'Enter an email like name@example.com.';
    if (!isClinic && !age.trim()) next.age = 'Enter your age.';
    if (!isClinic && !gender.trim()) next.gender = 'Choose an option.';
    if (!chiefComplaint.trim()) next.chiefComplaint = 'Tell us the main reason for your visit.';
    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid('visit-start-form');
      return;
    }

    setSubmitting(true);
    try {
      const detailsPayload: VisitStartDetails = {
        contactEmail: contactEmail.trim(), firstName: firstName.trim(), lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined, age: age.trim() ? Number.parseInt(age, 10) : undefined,
        gender: gender.trim() || undefined, chiefComplaint: chiefComplaint.trim(), details: details.trim() || undefined,
      };
      if (clinic) {
        await clinic.onStart(detailsPayload);
        return;
      }
      const result = await createIntent({
        ...detailsPayload,
        phone: phone.trim(), age: Number.parseInt(age, 10), gender: gender.trim(),
      });

      setSession({
        patientId: result.patientId,
        encounterId: result.encounterId,
        hospitalSlug: null,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        age: Number.parseInt(age, 10),
        gender: gender.trim(),
        chiefComplaint: chiefComplaint.trim(),
        details: detailsPayload.details,
      });
      navigate('/guest/chatbot');
    } catch (error) {
      setErrors({ form: friendlyError(error, isClinic ? 'We couldn’t start this visit. Please try again.' : 'We couldn’t start your check-in. Please try again.') });
    } finally {
      setSubmitting(false);
    }
  }

  const accountSummary = [[firstName, lastName].filter(Boolean).join(' '), age ? `age ${age}` : '', phone].filter(Boolean).join(', ');
  const blocked = isClinic && !clinic.bookingAvailable;

  return (
    <FlowScreen
      title="About you"
      counter="Step 1 of 3"
      progress={12}
      onBack={isClinic ? undefined : () => navigate('/welcome')}
      label="About you"
      footer={(
        <CtaButton type="submit" form="visit-start-form" busy={submitting} disabled={submitting || blocked}>
          {submitting ? 'Starting…' : 'Start assessment'}
        </CtaButton>
      )}
    >
      <div className="stack stack--sm">
        {isClinic && (
          <span className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="building" size={18} />
            {clinic.name}
          </span>
        )}
        <h1 className="display">{usesAccount ? 'What’s going on today?' : 'First, a little about you'}</h1>
        <p className="lede">
          {isClinic
            ? 'Only this clinic sees your answers. After a short assessment you can request an appointment time.'
            : 'Your answers go to the care team you choose next.'}
        </p>
        {clinic?.authActions}
      </div>

      {blocked && (
        <p className="notice notice--warn" role="status">
          <Icon name="clock" size={18} />
          <span>This clinic isn’t accepting appointment requests right now.</span>
        </p>
      )}

      <form id="visit-start-form" className="form" onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <p className="notice notice--danger" role="alert">
            <Icon name="alertCircle" size={18} />
            <span>{errors.form}</span>
          </p>
        )}

        {usesAccount ? (
          <div className="link-card link-card--static">
            <span className="tile__icon tile__icon--neutral"><Icon name="user" /></span>
            <span className="row__main">
              <span className="row__key">Using your account details</span>
              <span className="row__value">{accountSummary || 'Your patient account'}</span>
            </span>
          </div>
        ) : (
          <div className="field__row">
            <TextField label="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" error={errors.firstName} />
            <TextField label="Last name" optional value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
          </div>
        )}

        <TextField
          label="Email for visit updates"
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          autoComplete="email"
          error={errors.contactEmail}
          hint={<FieldHint>Used only for this visit. It doesn’t create an account.</FieldHint>}
        />

        {!usesAccount && (
          <>
            <TextField
              label="Phone number"
              optional={isClinic}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              error={errors.phone}
            />
            <div className="field__row">
              <TextField
                label="Age"
                optional={isClinic}
                inputMode="numeric"
                value={age}
                onChange={(event) => setAge(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                error={errors.age}
              />
              <SelectField label="Sex" optional={isClinic} value={gender} onChange={(event) => setGender(event.target.value)} error={errors.gender}>
                <option value="">Select</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Intersex">Intersex</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </SelectField>
            </div>
          </>
        )}

        <TextAreaField
          label="What’s the main reason for your visit?"
          value={chiefComplaint}
          onChange={(event) => setChiefComplaint(event.target.value.slice(0, COMPLAINT_LIMIT))}
          placeholder="For example: sore throat and fever since Sunday"
          rows={3}
          error={errors.chiefComplaint}
          count={`${chiefComplaint.length} / ${COMPLAINT_LIMIT}`}
        />

        <TextAreaField
          label="Anything else the care team should know?"
          optional
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="When it started, what makes it better or worse, medications you’ve taken"
          rows={3}
        />
      </form>

      <p className="safety-line">
        <Icon name="alertTriangle" size={18} />
        <span><strong>Emergency?</strong> Call 911 or go to the nearest emergency department.</span>
      </p>
    </FlowScreen>
  );
}
