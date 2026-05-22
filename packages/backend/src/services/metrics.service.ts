import { prisma } from '../lib/prisma';
import { countEvents } from './analytics.service';
import { ReviewService } from './review.service';
import { AnalyticsEventType } from '../generated/prisma/enums';

// --- Interfaces ---

export interface MarketplaceMetricsResponse {
  conversionRate: number; // confirmed / page_views as percentage
  averageRating: number | null; // arithmetic mean, 1 decimal
  repeatCustomerPercent: number; // returning / total unique, 90 days
  completedThisMonth: number;
  avgResponseTimeMinutes: number | null; // booking → confirmation, last 30
}

// --- Algorithms ---

/**
 * Calculates booking conversion rate as a percentage with 2 decimal places.
 * Returns 0 when pageViews is 0 to avoid division by zero.
 */
export function calculateConversionRate(
  confirmedAppointments: number,
  pageViews: number,
): number {
  if (pageViews === 0) return 0;
  return Math.round((confirmedAppointments / pageViews) * 10000) / 100;
}

/**
 * Calculates the percentage of clients who have 2+ appointments
 * out of all unique clients in the given appointment set.
 */
export function calculateRepeatCustomerPercent(
  appointments: Array<{ client_id: string | null }>,
): number {
  const clientCounts = new Map<string, number>();
  for (const appt of appointments) {
    if (!appt.client_id) continue;
    clientCounts.set(
      appt.client_id,
      (clientCounts.get(appt.client_id) || 0) + 1,
    );
  }
  const totalUnique = clientCounts.size;
  if (totalUnique === 0) return 0;
  const returning = [...clientCounts.values()].filter(
    (count) => count >= 2,
  ).length;
  return Math.round((returning / totalUnique) * 100);
}

// --- Service ---

export const MetricsService = {
  /**
   * Retrieves all marketplace KPIs in a single call.
   * Targets <500ms response time by running independent queries in parallel.
   */
  async getMarketplaceMetrics(
    tenantId: string,
  ): Promise<MarketplaceMetricsResponse> {
    const now = new Date();

    // Start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 90 days ago for repeat customer calculation
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Run all independent queries in parallel for performance
    const [
      pageViewCount,
      confirmedThisMonth,
      completedThisMonth,
      averageRating,
      appointmentsLast90Days,
      recentConfirmedAppointments,
    ] = await Promise.all([
      // Page views this month for conversion rate
      countEvents(tenantId, AnalyticsEventType.PAGE_VIEW, startOfMonth),

      // Confirmed appointments this month for conversion rate
      prisma.appointment.count({
        where: {
          tenant_id: tenantId,
          status: 'CONFIRMADO',
          created_at: { gte: startOfMonth },
        },
      }),

      // Completed appointments this month
      prisma.appointment.count({
        where: {
          tenant_id: tenantId,
          status: 'CONCLUIDO',
          data_hora: { gte: startOfMonth },
        },
      }),

      // Average rating from ReviewService
      ReviewService.getAggregateRating(tenantId),

      // Appointments in last 90 days for repeat customer %
      prisma.appointment.findMany({
        where: {
          tenant_id: tenantId,
          created_at: { gte: ninetyDaysAgo },
        },
        select: { client_id: true },
      }),

      // Last 30 confirmed appointments for avg response time
      prisma.appointment.findMany({
        where: {
          tenant_id: tenantId,
          status: 'CONFIRMADO',
        },
        orderBy: { updated_at: 'desc' },
        take: 30,
        select: {
          created_at: true,
          updated_at: true,
        },
      }),
    ]);

    // Calculate conversion rate
    const conversionRate = calculateConversionRate(
      confirmedThisMonth,
      pageViewCount,
    );

    // Calculate repeat customer percentage
    const repeatCustomerPercent =
      calculateRepeatCustomerPercent(appointmentsLast90Days);

    // Calculate average response time in minutes
    const avgResponseTimeMinutes =
      calculateAvgResponseTime(recentConfirmedAppointments);

    return {
      conversionRate,
      averageRating,
      repeatCustomerPercent,
      completedThisMonth,
      avgResponseTimeMinutes,
    };
  },
};

/**
 * Calculates the average time (in minutes) between appointment creation
 * and confirmation (approximated by updated_at for status change).
 * Returns null if no confirmed appointments exist.
 */
function calculateAvgResponseTime(
  appointments: Array<{ created_at: Date; updated_at: Date }>,
): number | null {
  if (appointments.length === 0) return null;

  let totalMinutes = 0;
  let validCount = 0;

  for (const appt of appointments) {
    const diffMs = appt.updated_at.getTime() - appt.created_at.getTime();
    // Only count positive differences (updated_at should be after created_at)
    if (diffMs > 0) {
      totalMinutes += diffMs / (1000 * 60);
      validCount++;
    }
  }

  if (validCount === 0) return null;
  return Math.round(totalMinutes / validCount);
}
