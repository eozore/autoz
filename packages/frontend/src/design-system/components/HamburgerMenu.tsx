import { type CSSProperties, type ReactNode, useCallback, useEffect, useState } from 'react';
import { MEDIA_QUERIES } from '../breakpoints';

export interface HamburgerMenuProps {
  /** Content to render inside the collapsible sidebar */
  children?: ReactNode;
  /** Whether the menu is open (controlled mode) */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Accessible label for the toggle button */
  ariaLabel?: string;
}

const overlayStyles: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  zIndex: 998,
  transition: 'opacity var(--ds-transition-base)',
};

const sidebarStyles: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  width: '280px',
  maxWidth: '80vw',
  backgroundColor: 'var(--ds-color-bg-sidebar)',
  zIndex: 999,
  overflowY: 'auto',
  transition: 'transform var(--ds-transition-base)',
  boxShadow: 'var(--ds-shadow-xl)',
};

const buttonStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 'var(--ds-touch-target-min)',
  minHeight: 'var(--ds-touch-target-min)',
  padding: 'var(--ds-space-2)',
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  borderRadius: 'var(--ds-radius-sm)',
  transition: 'background-color var(--ds-transition-fast)',
};

function HamburgerIcon({ open }: { open: boolean }) {
  const lineBase: CSSProperties = {
    display: 'block',
    width: '22px',
    height: '2px',
    backgroundColor: 'var(--ds-color-text-primary)',
    borderRadius: '1px',
    transition: 'transform var(--ds-transition-fast), opacity var(--ds-transition-fast)',
  };

  return (
    <span
      aria-hidden="true"
      style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}
    >
      <span
        style={{
          ...lineBase,
          transform: open ? 'rotate(45deg) translate(5px, 5px)' : 'none',
        }}
      />
      <span
        style={{
          ...lineBase,
          opacity: open ? 0 : 1,
        }}
      />
      <span
        style={{
          ...lineBase,
          transform: open ? 'rotate(-45deg) translate(5px, -5px)' : 'none',
        }}
      />
    </span>
  );
}

export function HamburgerMenu({
  children,
  open: controlledOpen,
  onOpenChange,
  ariaLabel = 'Abrir menu de navegação',
}: HamburgerMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MEDIA_QUERIES.mobile).matches;
  });

  const isOpen = controlledOpen ?? internalOpen;

  const setOpen = useCallback(
    (value: boolean) => {
      if (onOpenChange) {
        onOpenChange(value);
      } else {
        setInternalOpen(value);
      }
    },
    [onOpenChange],
  );

  // Track mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia(MEDIA_QUERIES.mobile);
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (!e.matches) {
        setOpen(false);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, setOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Only render the hamburger on mobile
  if (!isMobile) return null;

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        style={buttonStyles}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--ds-color-bg-muted)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <HamburgerIcon open={isOpen} />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          style={overlayStyles}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        role="navigation"
        aria-label="Menu principal"
        style={{
          ...sidebarStyles,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          visibility: isOpen ? 'visible' : 'hidden',
        }}
      >
        {children}
      </aside>
    </>
  );
}
