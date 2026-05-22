/**
 * Responsive breakpoint constants for the design system.
 *
 * - mobile: below 768px
 * - tablet: 768px to 1024px
 * - desktop: above 1024px
 */

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
} as const;

/** Media query strings for use in CSS-in-JS or matchMedia */
export const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.mobile - 1}px)`,
  tablet: `(min-width: ${BREAKPOINTS.mobile}px) and (max-width: ${BREAKPOINTS.tablet}px)`,
  desktop: `(min-width: ${BREAKPOINTS.tablet + 1}px)`,
} as const;

/**
 * Check if the current viewport matches a breakpoint.
 * Only works in browser environments.
 */
export function matchesBreakpoint(breakpoint: keyof typeof MEDIA_QUERIES): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MEDIA_QUERIES[breakpoint]).matches;
}
