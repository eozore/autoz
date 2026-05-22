import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { BadgeType } from '../generated/prisma/enums';
import { calculateCompleteness } from './onboarding.service';

// --- Types ---

export interface Badge {
  id: string;
  type: BadgeType;
  awardedAt: string;
  label: string;
}

export interface WeeklyEngagement {
  currentWeek: { appointments: number; newClients: number; revenue: number };
  previousWeek: { appointments: number; newClients: number; revenue: number };
}

export interface BadgesResponse {
  badges: Badge[];
  profileCompleteness: number;
  weeklyEngagement: WeeklyEngagement;
}

// --- Constants ---

const BADGE_LABELS: Record<BadgeType, string> = {
  PERFIL_COMPLETO: 'Perfil Completo',
  STREAK_MENSAL: 'Streak Mensal',
  PRIMEIRO_REVIEW: 'Primeira Avaliação',
};

const STREAK_THRESHOLD = 10;

// --- Helpers ---

/**
 * Returns the start of the current ISO week (Monday 00:00:00).
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Adjust so Monday = 0
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the end of the current ISO week (Sunday 23:59:59.999).
 */
function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Returns the start and end of the current calendar month.
 */
function getCurrentMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// --- Service ---

export const GamificationService = {
  /**
   * Check and award badges for a tenant based on current state.
   * Awards: perfil_completo, streak_mensal, primeiro_review.
   * Returns list of newly awarded badge types.
   */
  async checkAndAwardBadges(tenantId: string): Promise<BadgeType[]> {
    const newlyAwarded: BadgeType[] = [];

    // Fetch existing badges to avoid re-awarding
    const existingBadges = await prisma.badge.findMany({
      where: { tenant_id: tenantId },
      select: { type: true },
    });
    const existingTypes = new Set(existingBadges.map((b) => b.type));

    // --- perfil_completo: profile completeness reaches 100% ---
    if (!existingTypes.has('PERFIL_COMPLETO')) {
      const completedSteps = await prisma.onboardingProgress.findMany({
        where: { tenant_id: tenantId, completed: true },
        select: { step: true },
      });
      const completeness = calculateCompleteness(completedSteps.map((s) => s.step));
      if (completeness >= 100) {
        await prisma.badge.create({
          data: {
            tenant_id: tenantId,
            type: 'PERFIL_COMPLETO',
            awarded_at: new Date(),
          },
        });
        newlyAwarded.push('PERFIL_COMPLETO');
      }
    }

    // --- streak_mensal: 10 appointments completed in current calendar month ---
    if (!existingTypes.has('STREAK_MENSAL')) {
      const { start, end } = getCurrentMonthRange(new Date());
      const completedThisMonth = await prisma.appointment.count({
        where: {
          tenant_id: tenantId,
          status: 'CONCLUIDO',
          data_hora: { gte: start, lte: end },
        },
      });
      if (completedThisMonth >= STREAK_THRESHOLD) {
        await prisma.badge.create({
          data: {
            tenant_id: tenantId,
            type: 'STREAK_MENSAL',
            awarded_at: new Date(),
          },
        });
        newlyAwarded.push('STREAK_MENSAL');
      }
    }

    // --- primeiro_review: first review received ---
    if (!existingTypes.has('PRIMEIRO_REVIEW')) {
      const reviewCount = await prisma.review.count({
        where: { tenant_id: tenantId },
      });
      if (reviewCount >= 1) {
        await prisma.badge.create({
          data: {
            tenant_id: tenantId,
            type: 'PRIMEIRO_REVIEW',
            awarded_at: new Date(),
          },
        });
        newlyAwarded.push('PRIMEIRO_REVIEW');
      }
    }

    return newlyAwarded;
  },

  /**
   * Get all badges for a tenant.
   */
  async getBadges(tenantId: string): Promise<Badge[]> {
    const badges = await prisma.badge.findMany({
      where: { tenant_id: tenantId },
      orderBy: { awarded_at: 'desc' },
    });

    return badges.map((b) => ({
      id: b.id,
      type: b.type,
      awardedAt: b.awarded_at.toISOString(),
      label: BADGE_LABELS[b.type],
    }));
  },

  /**
   * Get weekly engagement comparing current week (Mon-Sun) vs previous week.
   * Metrics: appointments completed, new clients added, revenue earned.
   */
  async getWeeklyEngagement(tenantId: string): Promise<WeeklyEngagement> {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const currentWeekEnd = getWeekEnd(currentWeekStart);

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setMilliseconds(previousWeekEnd.getMilliseconds() - 1);

    const [currentWeekData, previousWeekData] = await Promise.all([
      this._getWeekMetrics(tenantId, currentWeekStart, currentWeekEnd),
      this._getWeekMetrics(tenantId, previousWeekStart, previousWeekEnd),
    ]);

    return {
      currentWeek: currentWeekData,
      previousWeek: previousWeekData,
    };
  },

  /**
   * Internal: get metrics for a specific week range.
   */
  async _getWeekMetrics(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<{ appointments: number; newClients: number; revenue: number }> {
    // Count completed appointments in the week
    const appointments = await prisma.appointment.count({
      where: {
        tenant_id: tenantId,
        status: 'CONCLUIDO',
        data_hora: { gte: start, lte: end },
      },
    });

    // Count new clients created in the week
    const newClients = await prisma.client.count({
      where: {
        tenant_id: tenantId,
        created_at: { gte: start, lte: end },
      },
    });

    // Sum revenue from completed appointments in the week
    const revenueResult = await prisma.appointment.aggregate({
      where: {
        tenant_id: tenantId,
        status: 'CONCLUIDO',
        data_hora: { gte: start, lte: end },
      },
      _sum: {
        valor_servico: true,
      },
    });

    const revenue = revenueResult._sum.valor_servico
      ? Number(revenueResult._sum.valor_servico)
      : 0;

    return { appointments, newClients, revenue };
  },

  /**
   * Get the full badges response including profile completeness and weekly engagement.
   */
  async getBadgesResponse(tenantId: string): Promise<BadgesResponse> {
    // Check and award any new badges first
    await this.checkAndAwardBadges(tenantId);

    // Fetch all data in parallel
    const [badges, completedSteps, weeklyEngagement] = await Promise.all([
      this.getBadges(tenantId),
      prisma.onboardingProgress.findMany({
        where: { tenant_id: tenantId, completed: true },
        select: { step: true },
      }),
      this.getWeeklyEngagement(tenantId),
    ]);

    const profileCompleteness = calculateCompleteness(
      completedSteps.map((s) => s.step),
    );

    return {
      badges,
      profileCompleteness,
      weeklyEngagement,
    };
  },
};
