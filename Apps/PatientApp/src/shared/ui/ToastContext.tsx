// PatientApp/src/shared/ui/ToastContext.tsx
// Lightweight toast notifications: one quiet ink pill, colour only on the icon.

import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { Icon } from './Icon';

type ToastVariant = 'error' | 'success' | 'info';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

const VARIANT_ICON = {
  error: 'alertCircle',
  success: 'check',
  info: 'info',
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'error') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, variant }].slice(-3));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, variant === 'error' ? 7000 : 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map(toast => (
          <div key={toast.id} className="toast" role={toast.variant === 'error' ? 'alert' : 'status'}>
            <span className={`toast__icon toast__icon--${toast.variant}`}>
              <Icon name={VARIANT_ICON[toast.variant]} size={13} strokeWidth={2.6} />
            </span>
            <span className="toast__message">{toast.message}</span>
            <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}
