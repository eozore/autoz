import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma, cleanDatabase } from '../test/setup';
import { AnalyticsEventType } from '../generated/prisma/enums';

// Mock the prisma module to use the test database prisma instance
vi.mock('../lib/prisma', async () => {
  const setup = await vi.importActual<typeof import('../test/setup')>('../test/setup');
  return { prisma: setup.prisma };
});

// Suppress logger output during tests
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { trackEvent, getEvents, countEvents } from '../services/analytics.service';
import { logger } from '../lib/logger';

describe('AnalyticsService', () => {
  let tenantId: string;

  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();
    // Create a tenant for testing
    const tenant = await prisma.tenant.create({
      data: { slug: 'test-analytics-tenant' },
    });
    tenantId = tenant.id;
  });

  describe('trackEvent', () => {
    it('should record a page_view event with metadata', async () => {
      await trackEvent(tenantId, AnalyticsEventType.PAGE_VIEW, {
        referrer: 'https://google.com',
        path: '/p/test-shop',
      });

      const events = await prisma.analyticsEvent.findMany({
        where: { tenant_id: tenantId },
      });

      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('PAGE_VIEW');
      expect(events[0].tenant_id).toBe(tenantId);
      expect(events[0].metadata).toEqual({
        referrer: 'https://google.com',
        path: '/p/test-shop',
      });
      expect(events[0].created_at).toBeInstanceOf(Date);
    });

    it('should record a booking_started event', async () => {
      await trackEvent(tenantId, AnalyticsEventType.BOOKING_STARTED, {
        service_id: 'svc-123',
        step: 1,
      });

      const events = await prisma.analyticsEvent.findMany({
        where: { tenant_id: tenantId },
      });

      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('BOOKING_STARTED');
      expect(events[0].metadata).toEqual({ service_id: 'svc-123', step: 1 });
    });

    it('should record a booking_completed event', async () => {
      await trackEvent(tenantId, AnalyticsEventType.BOOKING_COMPLETED, {
        appointment_id: 'apt-456',
      });

      const events = await prisma.analyticsEvent.findMany({
        where: { tenant_id: tenantId },
      });

      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('BOOKING_COMPLETED');
    });

    it('should record an onboarding_step_completed event', async () => {
      await trackEvent(tenantId, AnalyticsEventType.ONBOARDING_STEP_COMPLETED, {
        step: 'company_profile',
        elapsed_seconds: 120,
      });

      const events = await prisma.analyticsEvent.findMany({
        where: { tenant_id: tenantId },
      });

      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('ONBOARDING_STEP_COMPLETED');
      expect(events[0].metadata).toEqual({
        step: 'company_profile',
        elapsed_seconds: 120,
      });
    });

    it('should record a service_created event', async () => {
      await trackEvent(tenantId, AnalyticsEventType.SERVICE_CREATED, {
        service_name: 'Troca de Óleo',
      });

      const events = await prisma.analyticsEvent.findMany({
        where: { tenant_id: tenantId },
      });

      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('SERVICE_CREATED');
    });

    it('should record a review_submitted event', async () => {
      await trackEvent(tenantId, AnalyticsEventType.REVIEW_SUBMITTED, {
        rating: 5,
        appointment_id: 'apt-789',
      });

      const events = await prisma.analyticsEvent.findMany({
        where: { tenant_id: tenantId },
      });

      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('REVIEW_SUBMITTED');
    });

    it('should default metadata to empty object when not provided', async () => {
      await trackEvent(tenantId, AnalyticsEventType.PAGE_VIEW);

      const events = await prisma.analyticsEvent.findMany({
        where: { tenant_id: tenantId },
      });

      expect(events).toHaveLength(1);
      expect(events[0].metadata).toEqual({});
    });

    it('should NEVER throw even when database write fails', async () => {
      // Use an invalid tenant_id that violates FK constraint
      const invalidTenantId = '00000000-0000-0000-0000-000000000000';

      // This should NOT throw
      await expect(
        trackEvent(invalidTenantId, AnalyticsEventType.PAGE_VIEW, { test: true }),
      ).resolves.toBeUndefined();

      // Should have logged a warning
      expect(logger.warn).toHaveBeenCalledWith(
        'Analytics event write failed',
        expect.objectContaining({
          tenantId: invalidTenantId,
          eventType: 'PAGE_VIEW',
          error: expect.any(String),
        }),
      );
    });

    it('should not affect other operations when it fails silently', async () => {
      const invalidTenantId = 'non-existent-tenant-id';

      // trackEvent should complete without throwing
      await trackEvent(invalidTenantId, AnalyticsEventType.BOOKING_STARTED, {});

      // Verify the database is still operational
      const count = await prisma.analyticsEvent.count({
        where: { tenant_id: tenantId },
      });
      expect(count).toBe(0);
    });
  });

  describe('getEvents', () => {
    it('should retrieve events for a tenant', async () => {
      await prisma.analyticsEvent.createMany({
        data: [
          { tenant_id: tenantId, event_type: AnalyticsEventType.PAGE_VIEW, metadata: { p: 1 } },
          { tenant_id: tenantId, event_type: AnalyticsEventType.BOOKING_STARTED, metadata: { p: 2 } },
        ],
      });

      const events = await getEvents(tenantId);

      expect(events).toHaveLength(2);
      expect(events[0].event_type).toBeDefined();
      expect(events[1].event_type).toBeDefined();
    });

    it('should filter by event type', async () => {
      await prisma.analyticsEvent.createMany({
        data: [
          { tenant_id: tenantId, event_type: AnalyticsEventType.PAGE_VIEW, metadata: {} },
          { tenant_id: tenantId, event_type: AnalyticsEventType.BOOKING_STARTED, metadata: {} },
          { tenant_id: tenantId, event_type: AnalyticsEventType.PAGE_VIEW, metadata: {} },
        ],
      });

      const events = await getEvents(tenantId, { eventType: AnalyticsEventType.PAGE_VIEW });

      expect(events).toHaveLength(2);
      expect(events.every((e) => e.event_type === 'PAGE_VIEW')).toBe(true);
    });

    it('should return empty array when no events exist', async () => {
      const events = await getEvents(tenantId);
      expect(events).toEqual([]);
    });
  });

  describe('countEvents', () => {
    it('should count events by type for a tenant', async () => {
      await prisma.analyticsEvent.createMany({
        data: [
          { tenant_id: tenantId, event_type: AnalyticsEventType.PAGE_VIEW, metadata: {} },
          { tenant_id: tenantId, event_type: AnalyticsEventType.PAGE_VIEW, metadata: {} },
          { tenant_id: tenantId, event_type: AnalyticsEventType.BOOKING_STARTED, metadata: {} },
        ],
      });

      const count = await countEvents(tenantId, AnalyticsEventType.PAGE_VIEW);
      expect(count).toBe(2);
    });

    it('should filter by date range', async () => {
      const oldDate = new Date('2024-01-01');
      const recentDate = new Date();

      await prisma.analyticsEvent.createMany({
        data: [
          { tenant_id: tenantId, event_type: AnalyticsEventType.PAGE_VIEW, metadata: {}, created_at: oldDate },
          { tenant_id: tenantId, event_type: AnalyticsEventType.PAGE_VIEW, metadata: {}, created_at: recentDate },
        ],
      });

      const since = new Date('2025-01-01');
      const count = await countEvents(tenantId, AnalyticsEventType.PAGE_VIEW, since);
      expect(count).toBe(1);
    });

    it('should return 0 when no events match', async () => {
      const count = await countEvents(tenantId, AnalyticsEventType.REVIEW_SUBMITTED);
      expect(count).toBe(0);
    });
  });
});
