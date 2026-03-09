// PatientApp/src/shared/ui/ToastContext.tsx
// Lightweight toast notification system (matches HospitalApp pattern).

import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'error') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const variantStyles: Record<ToastVariant, { bg: string; border: string; color: string; icon: string }> = {
    error:   { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: '!' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: '\u2713' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'i' },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem',
          maxWidth: '90vw', width: '360px',
        }}>
          {toasts.map(toast => {
            const s = variantStyles[toast.variant];
            return (
              <div key={toast.id} style={{
                backgroundColor: s.bg, border: `1px solid ${s.border}`,
                borderRadius: '12px', padding: '0.75rem 1rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}>
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  backgroundColor: s.color, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                }}>{s.icon}</span>
                <div style={{ flex: 1, fontSize: '0.85rem', color: s.color, lineHeight: 1.4 }}>
                  {toast.message}
                </div>
                <button
                  onClick={() => dismiss(toast.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: s.color, opacity: 0.6, fontSize: '1.1rem', padding: 0,
                  }}
                >&times;</button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}
