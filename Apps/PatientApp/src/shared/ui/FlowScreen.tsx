import type { ReactNode } from 'react';

import { BackButton } from './Controls';
import { cx } from './cx';

interface FlowScreenProps {
  /** Short name of the current task, shown in the header when there is no step counter. */
  title?: string;
  /** Step position such as "Step 2 of 3"; shown instead of the title. */
  counter?: string;
  /** 0–100; omit to hide the progress bar. */
  progress?: number | null;
  onBack?: () => void;
  backLabel?: string;
  headerEnd?: ReactNode;
  /** Replaces the back/title header entirely (e.g. the brand bar). */
  header?: ReactNode;
  footer?: ReactNode;
  tone?: 'paper' | 'white' | 'navy';
  label?: string;
  children: ReactNode;
}

// One task per screen: header, optional progress, content, sticky action footer.
export function FlowScreen({
  title,
  counter,
  progress,
  onBack,
  backLabel,
  headerEnd,
  header,
  footer,
  tone = 'paper',
  label,
  children,
}: FlowScreenProps) {
  const showDefaultHeader = !header && (onBack || title || counter || headerEnd);
  return (
    <div className={cx('screen', tone === 'white' && 'screen--white', tone === 'navy' && 'screen--navy')}>
      {header}
      <div className="flow">
        {showDefaultHeader && (
          <header className="flow__header">
            {onBack && <BackButton onClick={onBack} label={backLabel} />}
            <div className="flow__heading">
              {counter ? <span className="counter">{counter}</span> : title && <span className="flow__heading-title">{title}</span>}
            </div>
            {headerEnd}
          </header>
        )}
        {progress != null && (
          <div className="flow__progress">
            <div className="progress" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
              <div className="progress__fill" style={{ width: `${Math.max(4, Math.min(100, progress))}%` }} />
            </div>
          </div>
        )}
        <main id="main" className="flow__body" aria-label={label}>
          {children}
        </main>
        {footer && <footer className="flow__footer">{footer}</footer>}
      </div>
    </div>
  );
}
