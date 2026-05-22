import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { BREAKPOINTS } from '../breakpoints';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Maximum width of the container. Defaults to responsive behavior. */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Horizontal padding */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Center the container horizontally */
  centered?: boolean;
  children?: ReactNode;
}

const maxWidthMap = {
  sm: '640px',
  md: `${BREAKPOINTS.mobile}px`,
  lg: `${BREAKPOINTS.tablet}px`,
  xl: '1280px',
  full: '100%',
} as const;

const paddingMap = {
  none: '0',
  sm: 'var(--ds-space-3)',
  md: 'var(--ds-space-4)',
  lg: 'var(--ds-space-6)',
} as const;

export function Container({
  maxWidth = 'lg',
  padding = 'md',
  centered = true,
  children,
  style,
  ...props
}: ContainerProps) {
  const containerStyles: CSSProperties = {
    width: '100%',
    maxWidth: maxWidthMap[maxWidth],
    paddingLeft: paddingMap[padding],
    paddingRight: paddingMap[padding],
    marginLeft: centered ? 'auto' : undefined,
    marginRight: centered ? 'auto' : undefined,
    ...style,
  };

  return (
    <div {...props} style={containerStyles}>
      {children}
    </div>
  );
}
