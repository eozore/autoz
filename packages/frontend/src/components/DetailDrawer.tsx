import { useEffect, useRef, type ReactNode } from 'react';

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function DetailDrawer({ open, onClose, title, children }: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        ref={drawerRef}
        style={drawerStyle}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={titleStyle}>{title}</h2>
          <button
            onClick={onClose}
            style={closeButtonStyle}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={contentStyle}>
          {children}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.4)',
  zIndex: 1000,
  display: 'flex',
  justifyContent: 'flex-end',
  animation: 'fadeIn 0.2s ease',
};

const drawerStyle: React.CSSProperties = {
  width: '400px',
  maxWidth: '100vw',
  height: '100vh',
  background: 'var(--bg-primary, #ffffff)',
  boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.12)',
  display: 'flex',
  flexDirection: 'column',
  animation: 'slideInRight 0.25s ease',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid var(--border-base, #e5e7eb)',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 700,
  color: 'var(--text-primary, #0f172a)',
  margin: 0,
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.25rem',
  cursor: 'pointer',
  color: 'var(--text-secondary, #64748b)',
  padding: '0.25rem 0.5rem',
  borderRadius: '6px',
  lineHeight: 1,
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '1.5rem',
};
