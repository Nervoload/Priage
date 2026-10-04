import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

import { cx } from './cx';
import { Icon } from './Icon';

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  count?: string;
  className?: string;
}

function FieldShell({ id, label, hint, error, optional, count, className, children }: FieldShellProps & { id: string; children: ReactNode }) {
  return (
    <div className={cx('field', className)}>
      <label htmlFor={id} className="field__label">
        {label}
        {optional && <span className="field__optional"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <span id={`${id}-message`} className="field__error">
          <Icon name="alertCircle" size={16} />
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-message`} className="field__hint">
          {hint}
        </span>
      ) : null}
      {count && <span className="field__count">{count}</span>}
    </div>
  );
}

function describedBy(id: string, hint: ReactNode, error?: string | null) {
  return error || hint ? `${id}-message` : undefined;
}

type TextFieldProps = FieldShellProps & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, hint, error, optional, count, className, id, ...inputProps }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} count={count} className={className}>
      <input
        id={fieldId}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...inputProps}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = FieldShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextAreaField({ label, hint, error, optional, count, className, id, ...textareaProps }: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} count={count} className={className}>
      <textarea
        id={fieldId}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...textareaProps}
      />
    </FieldShell>
  );
}

type SelectFieldProps = FieldShellProps & SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField({ label, hint, error, optional, count, className, id, children, ...selectProps }: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} count={count} className={className}>
      <select
        id={fieldId}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...selectProps}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <>
      <Icon name="info" size={16} />
      <span>{children}</span>
    </>
  );
}

/** Moves focus to the first invalid control inside a form after validation runs. */
export function focusFirstInvalid(formId: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(formId)?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
