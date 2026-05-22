import { Router, Request, Response } from 'express';
import { trackEvent } from '../services/analytics.service';
import { AnalyticsEventType } from '../generated/prisma/enums';
import { logger } from '../lib/logger';

const router = Router();

/**
 * Map from API event_type string to Prisma AnalyticsEventType enum.
 */
const EVENT_TYPE_MAP: Record<string, AnalyticsEventType> = {
  page_view: AnalyticsEventType.PAGE_VIEW,
  booking_started: AnalyticsEventType.BOOKING_STARTED,
  booking_completed: AnalyticsEventType.BOOKING_COMPLETED,
  onboarding_step_completed: AnalyticsEventType.ONBOARDING_STEP_COMPLETED,
  service_created: AnalyticsEventType.SERVICE_CREATED,
  review_submitted: AnalyticsEventType.REVIEW_SUBMITTED,
};

/**
 * POST /analytics/events — Record an analytics event (fire-and-forget, always returns 200).
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const { event_type, metadata } = req.body;

    const mappedType = EVENT_TYPE_MAP[event_type];
    if (!mappedType) {
      // Still return 200 — fire-and-forget semantics, but log the issue
      logger.warn('Unknown analytics event type', { event_type, tenantId });
      res.status(200).json({ recorded: false, reason: 'unknown_event_type' });
      return;
    }

    // Fire-and-forget: don't await, always return 200
    trackEvent(tenantId, mappedType, metadata || {});

    res.status(200).json({ recorded: true });
  } catch (err) {
    // Even on error, return 200 — analytics must never block
    logger.warn('Analytics route error', { error: String(err) });
    res.status(200).json({ recorded: false });
  }
});

export default router;
