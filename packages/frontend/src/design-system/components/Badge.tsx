import type { HTMLAttributes, ReactNode } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Badge content (text or icon) */
  children: ReactNode;
  /** Color variant */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the badge is a dot indicator (no text) */
  dot?: boolean;
}

const variantMap = {
  default: {
    backgroundColor: 'var(--ds-color-bg-muted)',
    color: 'var(--ds-color-text-secondary)',
  },
  primary: {
    backgroundColor: 'var(--ds-color-primary-glow)',
    color: 'var(--ds-color-primary)',
  },
  success: {
    backgroundColor: 'var(--ds-color-success-bg)',
    color: 'var(--ds-color-success)',
  },
  warning: {
    backgroundColor: 'var(--ds-color-warning-bg)',
    color: 'var(--ds-color-warning)',
  },
  danger: {
    backgroundColor: 'var(--ds-color-danger-bg)',
    color: 'var(--ds-color-danger)',
  },
  info: {
    backgroundColor: 'var(--ds-color-info-bg)',
    color: 'var(--ds-color-info)',
  },
} as const;

const sizeMap = {
  sm: {
    padding: 'var(--ds-space-1) var(--ds-space-2)',
    fontSize: 'var(--ds-font-size-xs)',
  },
  md: {
    padding: 'var(--ds-space-1) var(--ds-space-3)',
    fontSize: 'var(--ds-font-size-sm)',
  },
  lg: {
    padding: 'var(--ds-space-2) var(--ds-space-4)',
    fontSize: 'var(--ds-font-size-base)',
  },
} as const;

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  style,
  ...props
}: BadgeProps) {
  if (dot) {
    const dotStyles: React.CSSProperties = {
      display: 'inline-block',
      width: '8px',
      height: '8px',
      borderRadius: 'var(--ds-radius-full)',
      backgroundColor: variantMap[variant].color,
      ...style,
    };
    return <span {...props} style={dotStyles} aria-hidden="true" />;
  }

  const badgeStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--ds-space-1)',
    fontFamily: 'var(--ds-font-family)',
    fontWeight: 'var(--ds-font-weight-medium)',
    lineHeight: 'var(--ds-line-height-tight)',
    borderRadius: 'var(--ds-radius-full)',
    whiteSpace: 'nowrap',
    ...variantMap[variant],
    ...sizeMap[size],
    ...style,
  };

  return (
    <span {...props} style={badgeStyles}>
      {children}
    </span>
  );
}
