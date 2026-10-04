import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getMe } from '../shared/api/auth';
import { friendlyError } from '../shared/api/errors';
import { useAuth } from '../shared/hooks/useAuth';
import { useGuestSession } from '../shared/hooks/useGuestSession';
import { CtaButton } from '../shared/ui/Controls';
import { TextField, focusFirstInvalid } from '../shared/ui/Field';
import { FlowScreen } from '../shared/ui/FlowScreen';
import { Icon } from '../shared/ui/Icon';

interface SignupPageProps {
  onSwitchToLogin: () => void;
  onBack?: () => void;
}

type SignupErrors = Partial<Record<'email' | 'password' | 'confirmPassword' | 'age' | 'form', string>>;

export function SignupPage({ onSwitchToLogin, onBack }: SignupPageProps) {
  const { register, upgradeFromGuest } = useAuth();
  const { session: guestSession, clearSession: clearGuestSession } = useGuestSession();
  const [searchParams] = useSearchParams();
  const isGuestUpgrade = searchParams.get('mode') === 'guest-upgrade' && !!guestSession;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [errors, setErrors] = useState<SignupErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [prefilling, setPrefilling] = useState(isGuestUpgrade);

  useEffect(() => {
    if (!isGuestUpgrade) {
      setPrefilling(false);
      return;
    }

    let cancelled = false;

    async function loadPrefill() {
      try {
        const profile = await getMe();
        if (cancelled) return;
        setFirstName(profile.firstName ?? guestSession?.firstName ?? '');
        setLastName(profile.lastName ?? guestSession?.lastName ?? '');
        setPhone(profile.phone ?? '');
        setAge(profile.age != null ? String(profile.age) : guestSession?.age != null ? String(guestSession.age) : '');
        setGender(profile.gender ?? guestSession?.gender ?? '');
        setAllergies(profile.allergies ?? '');
        setConditions(profile.conditions ?? '');
      } catch {
        if (cancelled) return;
        setFirstName(guestSession?.firstName ?? '');
        setLastName(guestSession?.lastName ?? '');
        setAge(guestSession?.age != null ? String(guestSession.age) : '');
        setGender(guestSession?.gender ?? '');
      } finally {
        if (!cancelled) {
          setPrefilling(false);
        }
      }
    }

    void loadPrefill();
    return () => {
      cancelled = true;
    };
  }, [guestSession, isGuestUpgrade]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors: SignupErrors = {};
    if (!email.trim()) nextErrors.email = 'Enter an email you can sign in with.';
    if (password.length < 6) nextErrors.password = 'Use at least 6 characters.';
    if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords don’t match.';
    if (age && !/^\d{1,3}$/.test(age)) nextErrors.age = 'Enter your age in years.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid('signup-form');
      return;
    }

    setSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedFirstName = firstName.trim() || undefined;
      const normalizedLastName = lastName.trim() || undefined;
      const normalizedPhone = phone.trim() || undefined;

      if (isGuestUpgrade) {
        await upgradeFromGuest({
          email: normalizedEmail,
          password,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          phone: normalizedPhone,
          age: age ? parseInt(age, 10) : undefined,
          gender: gender.trim() || undefined,
          allergies: allergies.trim() || undefined,
          conditions: conditions.trim() || undefined,
        });
        clearGuestSession();
      } else {
        await register({
          email: normalizedEmail,
          password,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          phone: normalizedPhone,
        });
      }
    } catch (error) {
      setErrors({ form: friendlyError(error, 'We couldn’t create your account. Please try again.') });
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || prefilling;

  return (
    <FlowScreen
      title={isGuestUpgrade ? 'Save your visit' : 'Create account'}
      onBack={onBack}
      label="Create account"
      footer={(
        <>
          <CtaButton type="submit" form="signup-form" busy={submitting} disabled={disabled}>
            {submitting ? (isGuestUpgrade ? 'Saving your visit…' : 'Creating account…') : (isGuestUpgrade ? 'Save this visit' : 'Create account')}
          </CtaButton>
          <p className="flow__note">
            Already have an account?
            <button type="button" className="text-btn" style={{ minHeight: 0 }} onClick={onSwitchToLogin}>Sign in</button>
          </p>
        </>
      )}
    >
      <div className="stack stack--sm">
        <h1 className="display">{isGuestUpgrade ? 'Keep this visit with an account' : 'Create your account'}</h1>
        <p className="lede">
          {isGuestUpgrade
            ? 'Set a password and this visit, your answers and your messages stay together. We’ve filled in what you already told us.'
            : 'Keep your visits, answers and messages in one place.'}
        </p>
      </div>

      <form id="signup-form" className="form" onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <p className="notice notice--danger" role="alert">
            <Icon name="alertCircle" size={18} />
            <span>{errors.form}</span>
          </p>
        )}
        <div className="field__row">
          <TextField label="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" disabled={disabled} />
          <TextField label="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" disabled={disabled} />
        </div>
        <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" disabled={submitting} error={errors.email} />
        <TextField label="Phone" optional type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" disabled={disabled} />

        {isGuestUpgrade && (
          <>
            <div className="field__row">
              <TextField label="Age" optional inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value.replace(/[^\d]/g, ''))} disabled={disabled} error={errors.age} />
              <TextField label="Gender" optional value={gender} onChange={(event) => setGender(event.target.value)} disabled={disabled} />
            </div>
            <TextField label="Allergies" optional value={allergies} onChange={(event) => setAllergies(event.target.value)} disabled={disabled} />
            <TextField label="Conditions" optional value={conditions} onChange={(event) => setConditions(event.target.value)} disabled={disabled} />
          </>
        )}

        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          disabled={submitting}
          hint="At least 6 characters."
          error={errors.password}
        />
        <TextField
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          disabled={submitting}
          error={errors.confirmPassword}
        />
      </form>
    </FlowScreen>
  );
}
