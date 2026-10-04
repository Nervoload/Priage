import { useId, useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'dangerQuiet';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE = 'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,border-color,color,transform] duration-200 ease-quiet active:scale-[.98] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-[34px] rounded-[10px] px-3 text-[13px]',
  md: 'h-10 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-[14px] px-6 text-[15px]',
};
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border border-transparent bg-brand text-white hover:bg-brand-700',
  secondary: 'border border-line-strong bg-white text-ink hover:border-ink/30',
  quiet: 'px-2.5! border border-transparent text-brand-700 hover:bg-brand-select',
  danger: 'border border-transparent bg-signal-red text-white hover:bg-[#931C13]',
  dangerQuiet: 'px-2.5! border border-transparent text-signal-red hover:bg-signal-red-bg',
};

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', extra?: string): string {
  return cx(BUTTON_BASE, BUTTON_SIZES[size], BUTTON_VARIANTS[variant], extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  busy?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', icon, busy = false, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <Spinner /> : icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  outlined?: boolean;
}

export function IconButton({ icon, label, outlined = false, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        outlined && 'h-10 w-10 border border-line-strong bg-white',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}

export type Tone = 'amber' | 'blue' | 'green' | 'grey' | 'red';

const DOT: Record<Tone, string> = {
  amber: 'bg-signal-amber-dot',
  blue: 'bg-brand',
  green: 'bg-signal-green-dot',
  grey: 'bg-signal-grey-dot',
  red: 'bg-signal-red',
};
const TONE_TEXT: Record<Tone, string> = {
  amber: 'text-signal-amber',
  blue: 'text-brand-700',
  green: 'text-signal-green',
  grey: 'text-ink-2',
  red: 'text-signal-red',
};

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={cx('inline-block h-2 w-2 shrink-0 rounded-full', DOT[tone], className)} />;
}

/** Status is a coloured dot and a sentence. No pills. */
export function StatusLine({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-sm font-medium', TONE_TEXT[tone], className)}>
      <Dot tone={tone} />
      {children}
    </span>
  );
}

export const inputClass = 'h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:border-brand focus:ring-[3px] focus:ring-brand/20 disabled:bg-paper disabled:text-ink-3';
export const textareaClass = 'w-full resize-none rounded-xl border border-line-strong bg-white px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:border-brand focus:ring-[3px] focus:ring-brand/20';

export function Field({ label, htmlFor, hint, error, children, className }: { label: ReactNode; htmlFor: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">{label}</label>
      {children}
      {error ? <span className="text-[13px] font-medium text-signal-red">{error}</span> : hint && <span className="text-[13px] text-ink-3">{hint}</span>}
    </div>
  );
}

export interface TabDef<T extends string> { id: T; label: string; count?: number }

export function tabIds(base: string, id: string) {
  return { tab: `${base}-tab-${id}`, panel: `${base}-panel-${id}` };
}

export function Tabs<T extends string>({ tabs, value, onChange, label, idBase, className }: { tabs: Array<TabDef<T>>; value: T; onChange: (id: T) => void; label: string; idBase: string; className?: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className={cx('flex gap-6 border-b border-line', className)}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        const ids = tabIds(idBase, tab.id);
        return (
          <button
            key={tab.id}
            ref={(element) => { refs.current[index] = element; }}
            id={ids.tab}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={ids.panel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              '-mb-px flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand',
              selected ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count != null && <span className="font-medium tabular-nums text-ink-3">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function useStableId(prefix: string): string {
  return `${prefix}-${useId().replace(/:/g, '')}`;
}
