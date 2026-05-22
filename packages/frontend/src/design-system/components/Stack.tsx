import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** Stack direction */
  direction?: 'vertical' | 'horizontal';
  /** Gap between items */
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Alignment along the cross axis */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Alignment along the main axis */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  /** Whether items should wrap */
  wrap?: boolean;
  /** Take full width */
  fullWidth?: boolean;
  children?: ReactNode;
}

const gapMap = {
  none: '0',
  xs: 'var(--ds-space-1)',
  sm: 'var(--ds-space-2)',
  md: 'var(--ds-space-4)',
  lg: 'var(--ds-space-6)',
  xl: 'var(--ds-space-8)',
} as const;

const alignMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
} as const;

const justifyMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
} as const;

export function Stack({
  direction = 'vertical',
  gap = 'md',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  fullWidth = false,
  children,
  style,
  ...props
}: StackProps) {
  const stackStyles: CSSProperties = {
    display: 'flex',
    flexDirection: direction === 'vertical' ? 'column' : 'row',
    gap: gapMap[gap],
    alignItems: alignMap[align],
    justifyContent: justifyMap[justify],
    flexWrap: wrap ? 'wrap' : 'nowrap',
    width: fullWidth ? '100%' : undefined,
    ...style,
  };

  return (
    <div {...props} style={stackStyles}>
      {children}
    </div>
  );
}
