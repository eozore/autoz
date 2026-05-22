import { describe, it, expect } from 'vitest';
import { prisma } from '../test/setup';
import {
  createTenant,
  createFullTenantSetup,
  createAppointment,
  createClient,
} from '../test/factories';
import { GamificationService } from '../services/gamification.service';
import { OnboardingService } from '../services/onboarding.service';

describe('GamificationService', () => {
  describe('checkAndAwardBadges', () => {
    it('should award perfil_completo when all onboarding steps are completed', async () => {
      const tenant = await createTenant();

      // Complete all onboarding steps
      const steps = [
        'company_profile',
        'services_setup',
        'location_setup',
        'first_client',
        'first_appointment',
        'public_page_activation',
        'first_review_received',
      ] as const;

      for (const step of steps) {
        await OnboardingService.completeStep(tenant.id, step);
      }

      const awarded = await GamificationService.checkAndAwardBadges(tenant.id);

      expect(awarded).toContain('PERFIL_COMPLETO');

      // Verify persisted
      const badge = await prisma.badge.findUnique({
        where: { tenant_id_type: { tenant_id: tenant.id, type: 'PERFIL_COMPLETO' } },
      });
      expect(badge).not.toBeNull();
      expect(badge!.awarded_at).toBeInstanceOf(Date);
    });

    it('should NOT award perfil_completo when profile is incomplete', async () => {
      const tenant = await createTenant();

      await OnboardingService.completeStep(tenant.id, 'company_profile');
      await OnboardingService.completeStep(tenant.id, 'services_setup');

      const awarded = await GamificationService.checkAndAwardBadges(tenant.id);

      expect(awarded).not.toContain('PERFIL_COMPLETO');
    });

    it('should award streak_mensal when 10 appointments completed in current month', async () => {
      const { tenant, location } = await createFullTenantSetup();

      // Create 10 completed appointments in the current month
      const now = new Date();
      for (let i = 0; i < 10; i++) {
        const date = new Date(now.getFullYear(), now.getMonth(), Math.min(i + 1, 28));
        await createAppointment({
          tenantId: tenant.id,
          locationId: location.id,
          dataHora: date,
          status: 'CONCLUIDO',
        });
      }

      const awarded = await GamificationService.checkAndAwardBadges(tenant.id);

      expect(awarded).toContain('STREAK_MENSAL');

      const badge = await prisma.badge.findUnique({
        where: { tenant_id_type: { tenant_id: tenant.id, type: 'STREAK_MENSAL' } },
      });
      expect(badge).not.toBeNull();
    });

    it('should NOT award streak_mensal with fewer than 10 completed appointments', async () => {
      const { tenant, location } = await createFullTenantSetup();

      // Create only 9 completed appointments
      const now = new Date();
      for (let i = 0; i < 9; i++) {
        const date = new Date(now.getFullYear(), now.getMonth(), Math.min(i + 1, 28));
        await createAppointment({
          tenantId: tenant.id,
          locationId: location.id,
          dataHora: date,
          status: 'CONCLUIDO',
        });
      }

      const awarded = await GamificationService.checkAndAwardBadges(tenant.id);

      expect(awarded).not.toContain('STREAK_MENSAL');
    });

    it('should award primeiro_review when first review exists', async () => {
      const { tenant, location } = await createFullTenantSetup();

      const appointment = await createAppointment({
        tenantId: tenant.id,
        locationId: location.id,
        status: 'CONCLUIDO',
      });

      await prisma.review.create({
        data: {
          tenant_id: tenant.id,
          appointment_id: appointment.id,
          rating: 5,
          comment: 'Excelente serviço, recomendo!',
          customer_name: 'João Silva',
          vehicle_description: 'Toyota Corolla 2022',
        },
      });

      const awarded = await GamificationService.checkAndAwardBadges(tenant.id);

      expect(awarded).toContain('PRIMEIRO_REVIEW');
    });

    it('should NOT award primeiro_review when no reviews exist', async () => {
      const tenant = await createTenant();

      const awarded = await GamificationService.checkAndAwardBadges(tenant.id);

      expect(awarded).not.toContain('PRIMEIRO_REVIEW');
    });

    it('should not re-award an already existing badge', async () => {
      const { tenant, location } = await createFullTenantSetup();

      const appointment = await createAppointment({
        tenantId: tenant.id,
        locationId: location.id,
        status: 'CONCLUIDO',
      });

      await prisma.review.create({
        data: {
          tenant_id: tenant.id,
          appointment_id: appointment.id,
          rating: 4,
          comment: 'Bom serviço, voltarei novamente.',
          customer_name: 'Maria Santos',
          vehicle_description: 'Honda Civic 2021',
        },
      });

      // Award first time
      const firstAward = await GamificationService.checkAndAwardBadges(tenant.id);
      expect(firstAward).toContain('PRIMEIRO_REVIEW');

      // Try again - should not re-award
      const secondAward = await GamificationService.checkAndAwardBadges(tenant.id);
      expect(secondAward).not.toContain('PRIMEIRO_REVIEW');

      // Only one badge record should exist
      const badges = await prisma.badge.findMany({
        where: { tenant_id: tenant.id, type: 'PRIMEIRO_REVIEW' },
      });
      expect(badges).toHaveLength(1);
    });
  });

  describe('getBadges', () => {
    it('should return empty array when no badges exist', async () => {
      const tenant = await createTenant();

      const badges = await GamificationService.getBadges(tenant.id);

      expect(badges).toEqual([]);
    });

    it('should return badges with correct structure', async () => {
      const tenant = await createTenant();

      await prisma.badge.create({
        data: {
          tenant_id: tenant.id,
          type: 'PRIMEIRO_REVIEW',
          awarded_at: new Date('2024-06-15T10:00:00Z'),
        },
      });

      const badges = await GamificationService.getBadges(tenant.id);

      expect(badges).toHaveLength(1);
      expect(badges[0]).toMatchObject({
        type: 'PRIMEIRO_REVIEW',
        awardedAt: '2024-06-15T10:00:00.000Z',
        label: 'Primeira Avaliação',
      });
      expect(badges[0].id).toBeDefined();
    });
  });

  describe('getWeeklyEngagement', () => {
    it('should return zeros when no data exists', async () => {
      const tenant = await createTenant();

      const engagement = await GamificationService.getWeeklyEngagement(tenant.id);

      expect(engagement.currentWeek).toEqual({
        appointments: 0,
        newClients: 0,
        revenue: 0,
      });
      expect(engagement.previousWeek).toEqual({
        appointments: 0,
        newClients: 0,
        revenue: 0,
      });
    });

    it('should count completed appointments in current week', async () => {
      const { tenant, location } = await createFullTenantSetup();

      // Create an appointment today (should be in current week)
      const today = new Date();
      await createAppointment({
        tenantId: tenant.id,
        locationId: location.id,
        dataHora: today,
        status: 'CONCLUIDO',
      });

      const engagement = await GamificationService.getWeeklyEngagement(tenant.id);

      expect(engagement.currentWeek.appointments).toBe(1);
    });

    it('should count new clients in current week', async () => {
      const tenant = await createTenant();

      // Create a client today
      await createClient({ tenantId: tenant.id });

      const engagement = await GamificationService.getWeeklyEngagement(tenant.id);

      expect(engagement.currentWeek.newClients).toBe(1);
    });

    it('should separate current and previous week data', async () => {
      const { tenant, location } = await createFullTenantSetup();

      // Create appointment in previous week
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      await createAppointment({
        tenantId: tenant.id,
        locationId: location.id,
        dataHora: lastWeek,
        status: 'CONCLUIDO',
      });

      // Create appointment today (current week)
      await createAppointment({
        tenantId: tenant.id,
        locationId: location.id,
        dataHora: new Date(),
        status: 'CONCLUIDO',
      });

      const engagement = await GamificationService.getWeeklyEngagement(tenant.id);

      expect(engagement.currentWeek.appointments).toBe(1);
      expect(engagement.previousWeek.appointments).toBe(1);
    });
  });

  describe('getBadgesResponse', () => {
    it('should return full response with badges, completeness, and engagement', async () => {
      const tenant = await createTenant();

      await OnboardingService.completeStep(tenant.id, 'company_profile');

      const response = await GamificationService.getBadgesResponse(tenant.id);

      expect(response.badges).toEqual([]);
      expect(response.profileCompleteness).toBe(20);
      expect(response.weeklyEngagement).toBeDefined();
      expect(response.weeklyEngagement.currentWeek).toBeDefined();
      expect(response.weeklyEngagement.previousWeek).toBeDefined();
    });

    it('should auto-award badges when calling getBadgesResponse', async () => {
      const { tenant, location } = await createFullTenantSetup();

      // Create a review so primeiro_review can be awarded
      const appointment = await createAppointment({
        tenantId: tenant.id,
        locationId: location.id,
        status: 'CONCLUIDO',
      });

      await prisma.review.create({
        data: {
          tenant_id: tenant.id,
          appointment_id: appointment.id,
          rating: 5,
          comment: 'Serviço excelente, muito profissional!',
          customer_name: 'Carlos Oliveira',
          vehicle_description: 'VW Golf 2023',
        },
      });

      const response = await GamificationService.getBadgesResponse(tenant.id);

      expect(response.badges).toHaveLength(1);
      expect(response.badges[0].type).toBe('PRIMEIRO_REVIEW');
    });
  });
});
