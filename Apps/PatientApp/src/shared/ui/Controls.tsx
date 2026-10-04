import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import { cx } from './cx';
import { Icon, type IconName } from './Icon';

type CtaTone = 'primary' | 'danger' | 'inverse';

interface CtaContentProps {
  children: ReactNode;
  busy?: boolean;
  icon?: IconName;
}

function CtaContent({ children, busy, icon }: CtaContentProps) {
  return (
    <>
      {busy ? <span className="spinner spinner--sm spinner--on-fill" aria-hidden="true" /> : icon && <Icon name={icon} />}
      <span>{children}</span>
    </>
  );
}

// The one primary action on a screen. It says exactly what happens.
export function CtaButton({
  tone = 'primary',
  busy,
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: CtaContentProps & { tone?: CtaTone } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cx('btn btn--cta btn--block', `btn--${tone}`, className)} aria-busy={busy || undefined} {...rest}>
      <CtaContent busy={busy} icon={icon}>{children}</CtaContent>
    </button>
  );
}

export function CtaLink({ to, href, tone = 'primary', icon, children }: { to?: string; href?: string; tone?: CtaTone; icon?: IconName; children: ReactNode }) {
  const className = cx('btn btn--cta btn--block', `btn--${tone}`);
  if (href) {
    return (
      <a href={href} className={className}>
        <CtaContent icon={icon}>{children}</CtaContent>
      </a>
    );
  }
  return (
    <Link to={to ?? '/'} className={className}>
      <CtaContent icon={icon}>{children}</CtaContent>
    </Link>
  );
}

export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={onClick}>
      <Icon name="chevronLeft" />
    </button>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return <span className={cx('spinner', small && 'spinner--sm')} aria-hidden="true" />;
}

export function LoadingScreen({ label = 'Loading…', full }: { label?: string; full?: boolean }) {
  return (
    <div className={cx('loading-screen', full && 'loading-screen--full')} role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export type StatusTone = 'neutral' | 'amber' | 'blue' | 'green' | 'teal' | 'red';
export type StatusDot = 'solid' | 'ring' | 'square' | 'check' | 'x';

export function StatusPill({ tone, dot = 'solid', pulse, children }: { tone: StatusTone; dot?: StatusDot; pulse?: boolean; children: ReactNode }) {
  return (
    <span className={cx('status', `status--${tone}`)}>
      {dot === 'check' ? (
        <Icon name="check" size={13} strokeWidth={2.6} />
      ) : dot === 'x' ? (
        <Icon name="x" size={13} strokeWidth={2.6} />
      ) : (
        <span className={cx('status__dot', dot === 'ring' && 'status__dot--ring', dot === 'square' && 'status__dot--square', pulse && 'status__dot--pulse')} />
      )}
      {children}
    </span>
  );
}

export function Disclosure({ label, children, defaultOpen = false, icon = 'info' }: { label: ReactNode; children: ReactNode; defaultOpen?: boolean; icon?: IconName }) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" className="disclosure__toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        <Icon name={icon} size={18} />
        {label}
        <Icon name="chevronDown" size={16} className="disclosure__chevron" />
      </button>
      <div id={panelId} className={cx('disclosure__panel', open && 'is-open')}>
        <div>
          <div style={{ paddingTop: 12 }} aria-hidden={!open}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ModalProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  dismissible?: boolean;
}

export function Modal({ open, title, description, onClose, children, dismissible = true }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = dialogRef.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-dialog-close])');
    (focusable ?? dialogRef.current)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible) {
        onClose();
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)'));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [dismissible, onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && dismissible) onClose(); }}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal__head">
          <div className="stack stack--xs" style={{ flex: 1 }}>
            <h2 id={titleId} className="title">{title}</h2>
            {description && <p className="body">{description}</p>}
          </div>
          {dismissible && (
            <button type="button" className="icon-btn icon-btn--bare" aria-label="Close" data-dialog-close onClick={onClose}>
              <Icon name="x" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
