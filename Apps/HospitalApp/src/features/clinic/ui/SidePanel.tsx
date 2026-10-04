import { type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './controls';

interface SidePanelProps {
  label: string;
  onClose: () => void;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Changes when the record changes, so the body slides in again. */
  contentKey?: string | number;
}

// Shows one record beside the list it came from. On wide screens it sits
// beside the list instead of covering it; on narrower screens it overlays it.
// The parent gives it a fixed-height row to fill.
export function SidePanel({ label, onClose, header, footer, children, contentKey }: SidePanelProps) {
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <>
      <div aria-hidden="true" className="clinic-scrim-in fixed inset-0 z-40 bg-ink/20 xl:hidden" onClick={onClose} />
      <aside
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cx(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col bg-white shadow-[-28px_0_60px_-36px_rgba(14,22,48,.45)]',
          'xl:relative xl:inset-auto xl:z-auto xl:h-full xl:w-[520px] xl:max-w-none xl:shrink-0 xl:border-l xl:border-line xl:shadow-[-24px_0_50px_-44px_rgba(14,22,48,.45)] 2xl:w-[560px]',
        )}
      >
        <div className="shrink-0 px-6 pt-3.5">{header}</div>
        <div key={contentKey} className="clinic-panel-in min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">{children}</div>
        {footer && <div className="flex min-h-[72px] shrink-0 flex-wrap items-center gap-2.5 border-t border-line bg-white px-6 py-3.5">{footer}</div>}
      </aside>
    </>
  );
}
