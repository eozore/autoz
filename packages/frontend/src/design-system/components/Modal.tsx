import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when the modal requests to close (overlay click or close button) */
  onClose: () => void;
  /** Modal title displayed in the header */
  title?: string;
  /** Modal content */
  children: ReactNode;
  /** Optional CSS class for the modal container */
  className?: string;
}

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  padding: 'var(--ds-space-4)',
  animation: 'ds-modal-fade-in var(--ds-transition-fast)',
};

const containerStyles: React.CSSProperties = {
  position: 'relative',
  backgroundColor: 'var(--ds-color-bg-card)',
  borderRadius: 'var(--ds-radius-lg)',
  boxShadow: 'var(--ds-shadow-xl)',
  width: '100%',
  maxWidth: '42rem',
  maxHeight: '90vh',
  overflowX: 'hidden',
  overflowY: 'auto',
  boxSizing: 'border-box',
  animation: 'ds-modal-scale-in var(--ds-transition-base)',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--ds-space-5) var(--ds-space-6)',
  borderBottom: '1px solid var(--ds-color-border-light)',
};

const titleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--ds-font-size-lg)',
  fontWeight: 'var(--ds-font-weight-semibold)',
  color: 'var(--ds-color-text-primary)',
  lineHeight: 'var(--ds-line-height-tight)',
};

const closeButtonStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 'var(--ds-touch-target-min)',
  minHeight: 'var(--ds-touch-target-min)',
  border: 'none',
  background: 'transparent',
  borderRadius: 'var(--ds-radius-sm)',
  cursor: 'pointer',
  color: 'var(--ds-color-text-muted)',
  fontSize: 'var(--ds-font-size-xl)',
  lineHeight: 1,
  transition: 'color var(--ds-transition-fast), background var(--ds-transition-fast)',
};

const bodyStyles: React.CSSProperties = {
  padding: 'var(--ds-space-6)',
  overflowX: 'hidden',
  wordBreak: 'break-word',
};

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trap focus and handle Escape key
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus the container for accessibility
    containerRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div
      style={overlayStyles}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Modal'}
        tabIndex={-1}
        className={className}
        style={containerStyles}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div style={headerStyles}>
            <h2 style={titleStyles}>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar modal"
              style={closeButtonStyles}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--ds-color-text-primary)';
                e.currentTarget.style.background = 'var(--ds-color-bg-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--ds-color-text-muted)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ✕
            </button>
          </div>
        )}
        {!title && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            style={{
              ...closeButtonStyles,
              position: 'absolute',
              top: 'var(--ds-space-3)',
              right: 'var(--ds-space-3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--ds-color-text-primary)';
              e.currentTarget.style.background = 'var(--ds-color-bg-muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ds-color-text-muted)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ✕
          </button>
        )}
        <div style={bodyStyles}>{children}</div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
