import { useState, useRef, type ReactNode } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** The content to display inside the tooltip */
  content: ReactNode;
  /** The element that triggers the tooltip on hover */
  children: ReactNode;
  /** Position of the tooltip relative to the trigger */
  position?: TooltipPosition;
  /** Delay in ms before showing the tooltip */
  delay?: number;
  /** Optional CSS class for the tooltip container */
  className?: string;
}

const wrapperStyles: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
};

function getTooltipStyles(position: TooltipPosition, visible: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 1100,
    padding: 'var(--ds-space-2) var(--ds-space-3)',
    backgroundColor: 'var(--ds-color-bg-sidebar)',
    color: 'var(--ds-color-text-inverse)',
    fontSize: 'var(--ds-font-size-sm)',
    fontWeight: 'var(--ds-font-weight-normal)',
    lineHeight: 'var(--ds-line-height-normal)',
    borderRadius: 'var(--ds-radius-sm)',
    boxShadow: 'var(--ds-shadow-lg)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    opacity: visible ? 1 : 0,
    transition: 'opacity var(--ds-transition-fast)',
  };

  switch (position) {
    case 'top':
      return {
        ...base,
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: 'var(--ds-space-2)',
      };
    case 'bottom':
      return {
        ...base,
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: 'var(--ds-space-2)',
      };
    case 'left':
      return {
        ...base,
        right: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        marginRight: 'var(--ds-space-2)',
      };
    case 'right':
      return {
        ...base,
        left: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        marginLeft: 'var(--ds-space-2)',
      };
  }
}

const triggerStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 'var(--ds-touch-target-min)',
  minHeight: 'var(--ds-touch-target-min)',
};

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  }

  function handleMouseLeave() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }

  return (
    <div
      style={wrapperStyles}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      <div style={triggerStyles}>{children}</div>
      <div
        role="tooltip"
        aria-hidden={!visible}
        style={getTooltipStyles(position, visible)}
      >
        {content}
      </div>
    </div>
  );
}
