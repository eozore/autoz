import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card content */
  children: ReactNode;
  /** Whether to add padding inside the card */
  padded?: boolean;
  /** Whether the card has a hover elevation effect */
  hoverable?: boolean;
  /** Visual variant */
  variant?: 'default' | 'outlined' | 'elevated';
}

const baseStyles: React.CSSProperties = {
  backgroundColor: 'var(--ds-color-bg-card)',
  borderRadius: 'var(--ds-radius-lg)',
  overflow: 'hidden',
  transition: 'box-shadow var(--ds-transition-fast), transform var(--ds-transition-fast)',
};

const variantMap = {
  default: {
    border: '1px solid var(--ds-color-border-light)',
    boxShadow: 'var(--ds-shadow-sm)',
  },
  outlined: {
    border: '1px solid var(--ds-color-border-base)',
    boxShadow: 'none',
  },
  elevated: {
    border: 'none',
    boxShadow: 'var(--ds-shadow-md)',
  },
} as const;

export function Card({
  children,
  padded = true,
  hoverable = false,
  variant = 'default',
  style,
  ...props
}: CardProps) {
  const cardStyles: React.CSSProperties = {
    ...baseStyles,
    ...variantMap[variant],
    padding: padded ? 'var(--ds-space-5)' : undefined,
    cursor: hoverable ? 'pointer' : undefined,
    ...style,
  };

  return (
    <div
      {...props}
      style={cardStyles}
      onMouseEnter={(e) => {
        if (hoverable) {
          e.currentTarget.style.boxShadow = 'var(--ds-shadow-lg)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (hoverable) {
          e.currentTarget.style.boxShadow = variantMap[variant].boxShadow || 'var(--ds-shadow-sm)';
          e.currentTarget.style.transform = 'none';
        }
        props.onMouseLeave?.(e);
      }}
    >
      {children}
    </div>
  );
}
