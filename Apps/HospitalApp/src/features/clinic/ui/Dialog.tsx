import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { IconButton, cx } from './controls';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Muted text at the start of the footer. */
  footerNote?: ReactNode;
  width?: number;
  /** Alert dialogs ask about something consequential: no close button, no backdrop dismissal. */
  alert?: boolean;
  /** While busy, Esc and backdrop clicks do nothing. */
  busy?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  tone?: 'default' | 'danger';
  icon?: ReactNode;
}

// One decision per dialog. The title asks the question; the footer's primary
// button repeats the verb. Focus is trapped while open and returned on close.
export function Dialog({ open, onClose, title, description, children, footer, footerNote, width = 520, alert = false, busy = false, initialFocusRef, tone = 'default', icon }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current
        ?? panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')
        ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? panelRef.current)?.focus();
    });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!busy) onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 font-clinic text-ink" onKeyDown={onKeyDown}>
      <div
        aria-hidden="true"
        className="clinic-scrim-in absolute inset-0 bg-ink/25"
        onClick={() => { if (!alert && !busy) onClose(); }}
      />
      <div
        ref={panelRef}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          'clinic-dialog-in relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[20px] bg-white outline-none',
          tone === 'danger' ? 'shadow-[0_0_0_1px_rgba(180,35,24,.28),0_40px_90px_-40px_rgba(14,22,48,.55)]' : 'shadow-[0_0_0_1px_rgba(14,22,48,.06),0_40px_90px_-40px_rgba(14,22,48,.55)]',
        )}
        style={{ maxWidth: width }}
      >
        {tone === 'danger' && <div aria-hidden="true" className="h-1 shrink-0 bg-signal-red" />}
        <div className="flex items-start gap-3 px-6 pb-1 pt-[22px]">
          {icon}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="text-xl font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h2>
            {description && <p id={descriptionId} className="text-sm text-ink-2">{description}</p>}
          </div>
          {!alert && <IconButton icon="x" label="Close" onClick={onClose} disabled={busy} className="-mr-2 -mt-1.5" />}
        </div>
        {children && <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-[22px] pt-3 [&>*]:shrink-0">{children}</div>}
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-line bg-rail px-6 py-3.5">
            <span className="min-w-0 flex-1 text-[13px] text-ink-3">{footerNote}</span>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
