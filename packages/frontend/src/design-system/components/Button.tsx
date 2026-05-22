import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button takes full width */
  fullWidth?: boolean;
  /** Optional icon before the label */
  icon?: ReactNode;
  /** Loading state */
  loading?: boolean;
}

const sizeStyles = {
  sm: {
    padding: 'var(--ds-space-2) var(--ds-space-3)',
    fontSize: 'var(--ds-font-size-sm)',
  },
  md: {
    padding: 'var(--ds-space-3) var(--ds-space-5)',
    fontSize: 'var(--ds-font-size-base)',
  },
  lg: {
    padding: 'var(--ds-space-4) var(--ds-space-6)',
    fontSize: 'var(--ds-font-size-lg)',
  },
} as const;

const variantStyles = {
  primary: {
    backgroundColor: 'var(--ds-color-primary)',
    color: 'var(--ds-color-text-inverse)',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'var(--ds-color-bg-muted)',
    color: 'var(--ds-color-text-primary)',
    border: '1px solid var(--ds-color-border-base)',
  },
  outline: {
    backgroundColor: 'transparent',
    color: 'var(--ds-color-primary)',
    border: '1px solid var(--ds-color-primary)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--ds-color-text-secondary)',
    border: 'none',
  },
  danger: {
    backgroundColor: 'var(--ds-color-danger)',
    color: 'var(--ds-color-text-inverse)',
    border: 'none',
  },
} as const;

const hoverStyles = {
  primary: { backgroundColor: 'var(--ds-color-primary-hover)' },
  secondary: { backgroundColor: 'var(--ds-color-border-light)' },
  outline: { backgroundColor: 'var(--ds-color-primary-glow)' },
  ghost: { backgroundColor: 'var(--ds-color-bg-muted)' },
  danger: { backgroundColor: '#dc2626' },
} as const;

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  loading = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--ds-space-2)',
    minWidth: 'var(--ds-touch-target-min)',
    minHeight: 'var(--ds-touch-target-min)',
    fontFamily: 'var(--ds-font-family)',
    fontWeight: 'var(--ds-font-weight-medium)',
    lineHeight: 'var(--ds-line-height-tight)',
    borderRadius: 'var(--ds-radius-md)',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'background-color var(--ds-transition-fast), box-shadow var(--ds-transition-fast)',
    width: fullWidth ? '100%' : undefined,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={baseStyles}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, hoverStyles[variant]);
        }
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, variantStyles[variant]);
        }
        props.onMouseLeave?.(e);
      }}
    >
      {loading && <span aria-hidden="true">⏳</span>}
      {!loading && icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
}
