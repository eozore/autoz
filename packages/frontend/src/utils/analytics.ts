const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Fire-and-forget analytics event tracking.
 * Never throws or blocks — all errors are silently swallowed.
 */
export function trackEvent(
  eventType: string,
  metadata: Record<string, unknown>,
): void {
  fetch(`${BASE_URL}/api/analytics/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: eventType, metadata }),
  }).catch(() => {});
}

/**
 * Track a page view event on the public page.
 */
export function trackPageView(tenantId: string, referrer: string): void {
  trackEvent('page_view', { tenant_id: tenantId, referrer });
}

/**
 * Track when a user enters the booking flow.
 */
export function trackBookingStarted(serviceId: string, step: string): void {
  trackEvent('booking_started', { service_id: serviceId, step });
}

/**
 * Track when an onboarding step is completed.
 */
export function trackOnboardingStep(stepName: string, elapsedSeconds: number): void {
  trackEvent('onboarding_step_completed', { step_name: stepName, elapsed_seconds: elapsedSeconds });
}
