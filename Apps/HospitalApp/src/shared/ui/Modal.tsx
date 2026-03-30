// HospitalApp/src/shared/ui/Modal.tsx
// Shared modal component with grayed-out backdrop and slide-in animation.

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Width class, e.g. 'max-w-2xl', 'max-w-4xl'. Default: 'max-w-3xl' */
  width?: string;
  title?: ReactNode;
}

export function Modal({ open, onClose, children, width = 'max-w-3xl', title }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[3px]" />

      {/* Content panel */}
      <div
        className={`
          relative w-full rounded-[24px] border border-white/80 bg-white/95 shadow-[0_34px_90px_-52px_rgba(15,23,42,0.58)] ${width}
          max-h-[90vh] flex flex-col overflow-hidden
          animate-slide-up
        `}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/92 px-6 py-4">
            {typeof title === 'string' ? (
              <h2 className="font-hospital-display text-lg font-semibold tracking-[-0.02em] text-slate-900">{title}</h2>
            ) : (
              <div className="flex-1">{title}</div>
            )}
            <button
              onClick={onClose}
              className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
