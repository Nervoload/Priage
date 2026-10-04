import { useState } from 'react';

import { useAuth } from '../shared/hooks/useAuth';
import { friendlyError } from '../shared/api/errors';
import { CtaButton } from '../shared/ui/Controls';
import { TextField, focusFirstInvalid } from '../shared/ui/Field';
import { FlowScreen } from '../shared/ui/FlowScreen';
import { Icon } from '../shared/ui/Icon';

interface LoginPageProps {
  onSwitchToSignup: () => void;
  onBack?: () => void;
}

export function LoginPage({ onSwitchToSignup, onBack }: LoginPageProps) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = {
      email: email.trim() ? undefined : 'Enter the email you signed up with.',
      password: password ? undefined : 'Enter your password.',
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      focusFirstInvalid('login-form');
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (error) {
      setErrors({ form: friendlyError(error, 'We couldn’t sign you in. Check your email and password.') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FlowScreen
      title="Sign in"
      onBack={onBack}
      label="Sign in"
      footer={(
        <>
          <CtaButton type="submit" form="login-form" busy={submitting} disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </CtaButton>
          <p className="flow__note">
            New to Priage?
            <button type="button" className="text-btn" style={{ minHeight: 0 }} onClick={onSwitchToSignup}>Create an account</button>
          </p>
        </>
      )}
    >
      <div className="stack stack--sm">
        <h1 className="display">Welcome back</h1>
        <p className="lede">Sign in to see your visits and messages.</p>
      </div>

      <form id="login-form" className="form" onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <p className="notice notice--danger" role="alert">
            <Icon name="alertCircle" size={18} />
            <span>{errors.form}</span>
          </p>
        )}
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          autoFocus
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          error={errors.password}
        />
      </form>
    </FlowScreen>
  );
}
