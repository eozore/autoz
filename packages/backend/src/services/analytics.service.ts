import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AnalyticsEventType } from '../generated/prisma/enums';

export type { AnalyticsEventType };

/**
 * AnalyticsService — fire-and-forget event tracking.
 *
 * CRITICAL: trackEvent must NEVER throw. All errors are caught and logged
 * as warnings so that analytics failures never block user-facing operations.
 */

/**
 * Records an analytics event for a tenant. Catches all errors internally
 * and logs a warning — never throws.
 */
export async function trackEvent(
  tenantId: string,
  eventType: AnalyticsEventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        tenant_id: tenantId,
        event_type: eventType,
        metadata: metadata as any,
      },
    });
  } catch (error: unknown) {
    // Log but never throw — analytics must not block user operations
    logger.warn('Analytics event write failed', {
      tenantId,
      eventType,
      error: String(error),
    });
  }
}

/**
 * Retrieves analytics events for a tenant, optionally filtered by event type.
 * This is a read operation used for metrics — also fail-silent.
 */
export async function getEvents(
  tenantId: string,
  options?: {
    eventType?: AnalyticsEventType;
    since?: Date;
    limit?: number;
  },
): Promise<Array<{ id: string; event_type: AnalyticsEventType; metadata: unknown; created_at: Date }>> {
  try {
    const events = await prisma.analyticsEvent.findMany({
      where: {
        tenant_id: tenantId,
        ...(options?.eventType && { event_type: options.eventType }),
        ...(options?.since && { created_at: { gte: options.since } }),
      },
      orderBy: { created_at: 'desc' },
      take: options?.limit ?? 100,
      select: {
        id: true,
        event_type: true,
        metadata: true,
        created_at: true,
      },
    });
    return events;
  } catch (error: unknown) {
    logger.warn('Analytics event read failed', {
      tenantId,
      error: String(error),
    });
    return [];
  }
}

/**
 * Counts analytics events for a tenant by event type within a date range.
 * Used for conversion rate calculations. Fail-silent — returns 0 on error.
 */
export async function countEvents(
  tenantId: string,
  eventType: AnalyticsEventType,
  since?: Date,
): Promise<number> {
  try {
    return await prisma.analyticsEvent.count({
      where: {
        tenant_id: tenantId,
        event_type: eventType,
        ...(since && { created_at: { gte: since } }),
      },
    });
  } catch (error: unknown) {
    logger.warn('Analytics event count failed', {
      tenantId,
      eventType,
      error: String(error),
    });
    return 0;
  }
}
