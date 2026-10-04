import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dot } from './controls';

interface ToastInput {
  message: string;
  /** Errors get a red dot; everything else is a plain confirmation. */
  tone?: 'neutral' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  /** Called when the toast leaves without its action being used. */
  onExpire?: () => void;
  durationMs?: number;
}

interface ToastState extends ToastInput { id: number }

const ToastContext = createContext<{ show: (toast: ToastInput) => void; dismiss: () => void } | null>(null);

// One toast at a time, bottom centre, in the ink colour of the brand.
export function ClinicToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const current = useRef<ToastState | null>(null);
  const nextId = useRef(1);

  const finish = useCallback((runExpire: boolean) => {
    window.clearTimeout(timer.current);
    const leaving = current.current;
    current.current = null;
    setToast(null);
    if (runExpire) leaving?.onExpire?.();
  }, []);

  const show = useCallback((input: ToastInput) => {
    if (current.current) finish(true);
    const next = { ...input, id: nextId.current++ };
    current.current = next;
    setToast(next);
    timer.current = window.setTimeout(() => finish(true), input.durationMs ?? 5000);
  }, [finish]);

  const dismiss = useCallback(() => finish(true), [finish]);

  // A toast can hold a deferred action (Undo). Leaving the page or the clinic
  // workspace runs it now rather than dropping it.
  useEffect(() => {
    const flush = () => { if (current.current) finish(true); };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.clearTimeout(timer.current);
      current.current?.onExpire?.();
      current.current = null;
    };
  }, [finish]);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-6 left-1/2 z-[130] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 font-clinic lg:left-[256px] lg:translate-x-0">
        {toast && (
          <div key={toast.id} className="clinic-toast-in pointer-events-auto flex items-center gap-3.5 rounded-full bg-ink py-2 pl-[18px] pr-2 text-sm text-paper shadow-[0_20px_40px_-16px_rgba(14,22,48,.55)]">
            {toast.tone === 'error' && <Dot tone="red" />}
            <span className="min-w-0 py-1.5">{toast.message}</span>
            {toast.actionLabel ? (
              <button
                type="button"
                className="h-8 shrink-0 rounded-full bg-white/12 px-3.5 text-[13px] font-semibold text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
                onClick={() => { const action = current.current?.onAction; finish(false); action?.(); }}
              >
                {toast.actionLabel}
              </button>
            ) : (
              <button type="button" aria-label="Dismiss" className="h-8 w-8 shrink-0 rounded-full text-white/70 hover:bg-white/12 hover:text-white" onClick={() => finish(true)}>×</button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useClinicToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useClinicToast must be used inside ClinicToastProvider');
  return context;
}
