import { type CSSProperties, type HTMLAttributes, type ReactNode, useEffect, useState } from 'react';
import { BREAKPOINTS, MEDIA_QUERIES } from '../breakpoints';

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of columns at each breakpoint */
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  /** Gap between grid items */
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Minimum column width for auto-fit behavior (overrides columns) */
  minColumnWidth?: string;
  children?: ReactNode;
}

const gapMap = {
  none: '0',
  sm: 'var(--ds-space-2)',
  md: 'var(--ds-space-4)',
  lg: 'var(--ds-space-6)',
  xl: 'var(--ds-space-8)',
} as const;

function useCurrentBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < BREAKPOINTS.mobile) return 'mobile';
    if (width <= BREAKPOINTS.tablet) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    const mobileQuery = window.matchMedia(MEDIA_QUERIES.mobile);
    const tabletQuery = window.matchMedia(MEDIA_QUERIES.tablet);

    function update() {
      if (mobileQuery.matches) setBreakpoint('mobile');
      else if (tabletQuery.matches) setBreakpoint('tablet');
      else setBreakpoint('desktop');
    }

    mobileQuery.addEventListener('change', update);
    tabletQuery.addEventListener('change', update);
    return () => {
      mobileQuery.removeEventListener('change', update);
      tabletQuery.removeEventListener('change', update);
    };
  }, []);

  return breakpoint;
}

export function Grid({
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
  minColumnWidth,
  children,
  style,
  ...props
}: GridProps) {
  const breakpoint = useCurrentBreakpoint();

  const gridTemplateColumns = minColumnWidth
    ? `repeat(auto-fit, minmax(${minColumnWidth}, 1fr))`
    : `repeat(${columns[breakpoint] ?? 1}, 1fr)`;

  const gridStyles: CSSProperties = {
    display: 'grid',
    gridTemplateColumns,
    gap: gapMap[gap],
    ...style,
  };

  return (
    <div {...props} style={gridStyles}>
      {children}
    </div>
  );
}

export { useCurrentBreakpoint };
