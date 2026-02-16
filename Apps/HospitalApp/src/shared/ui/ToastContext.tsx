// HospitalApp/src/shared/ui/ToastContext.tsx
// Lightweight toast notification system.
// Usage: wrap app with <ToastProvider>, then call showToast() from any component.

import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'error') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, variant }]);
    // Auto-dismiss after 5s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const variantStyles: Record<ToastVariant, { bg: string; border: string; color: string; icon: string }> = {
    error:   { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: '✕' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: '✓' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ' },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container — fixed bottom-right */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxWidth: '400px',
          }}
        >
          {toasts.map(toast => {
            const s = variantStyles[toast.variant];
            return (
              <div
                key={toast.id}
                style={{
                  backgroundColor: s.bg,
                  border: `1px solid ${s.border}`,
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  animation: 'toastSlideIn 0.25s ease-out',
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: s.color,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                >
                  {s.icon}
                </span>
                <div style={{ flex: 1, fontSize: '0.85rem', color: s.color, lineHeight: 1.4 }}>
                  {toast.message}
                </div>
                <button
                  onClick={() => dismiss(toast.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: s.color,
                    opacity: 0.6,
                    fontSize: '1rem',
                    lineHeight: 1,
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-in animation */}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}
