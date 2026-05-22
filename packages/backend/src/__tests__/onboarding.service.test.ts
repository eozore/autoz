import { describe, it, expect } from 'vitest';
import { prisma } from '../test/setup';
import { createTenant } from '../test/factories';
import {
  OnboardingService,
  calculateCompleteness,
  persistWithRetry,
} from '../services/onboarding.service';
import { OnboardingStepKey } from '../generated/prisma/enums';

describe('OnboardingService', () => {
  describe('completeStep', () => {
    it('should persist a step as completed with timestamp', async () => {
      const tenant = await createTenant();

      const result = await OnboardingService.completeStep(tenant.id, 'company_profile');

      expect(result.success).toBe(true);
      expect(result.step.key).toBe('company_profile');
      expect(result.step.completed).toBe(true);
      expect(result.step.completedAt).not.toBeNull();
      expect(result.completenessPercent).toBe(20);
    });

    it('should be idempotent - completing same step twice succeeds', async () => {
      const tenant = await createTenant();

      await OnboardingService.completeStep(tenant.id, 'services_setup');
      const result = await OnboardingService.completeStep(tenant.id, 'services_setup');

      expect(result.success).toBe(true);
      expect(result.step.completed).toBe(true);
    });

    it('should accumulate completeness across multiple steps', async () => {
      const tenant = await createTenant();

      await OnboardingService.completeStep(tenant.id, 'company_profile'); // 20
      const result = await OnboardingService.completeStep(tenant.id, 'services_setup'); // +20

      expect(result.completenessPercent).toBe(40);
    });

    it('should reach 100% when all steps are completed', async () => {
      const tenant = await createTenant();

      const steps: Array<'company_profile' | 'services_setup' | 'location_setup' | 'first_client' | 'first_appointment' | 'public_page_activation' | 'first_review_received'> = [
        'company_profile',
        'services_setup',
        'location_setup',
        'first_client',
        'first_appointment',
        'public_page_activation',
        'first_review_received',
      ];

      let result;
      for (const step of steps) {
        result = await OnboardingService.completeStep(tenant.id, step);
      }

      expect(result!.completenessPercent).toBe(100);
    });
  });

  describe('getProgress', () => {
    it('should return all 7 steps with default uncompleted state', async () => {
      const tenant = await createTenant();

      const progress = await OnboardingService.getProgress(tenant.id);

      expect(progress.steps).toHaveLength(7);
      expect(progress.completenessPercent).toBe(0);
      expect(progress.allCompleted).toBe(false);
      expect(progress.steps.every((s) => !s.completed)).toBe(true);
      expect(progress.steps.every((s) => s.completedAt === null)).toBe(true);
    });

    it('should reflect completed steps correctly', async () => {
      const tenant = await createTenant();

      await OnboardingService.completeStep(tenant.id, 'company_profile');
      await OnboardingService.completeStep(tenant.id, 'first_client');

      const progress = await OnboardingService.getProgress(tenant.id);

      const companyStep = progress.steps.find((s) => s.key === 'company_profile');
      const clientStep = progress.steps.find((s) => s.key === 'first_client');
      const servicesStep = progress.steps.find((s) => s.key === 'services_setup');

      expect(companyStep!.completed).toBe(true);
      expect(companyStep!.completedAt).not.toBeNull();
      expect(clientStep!.completed).toBe(true);
      expect(clientStep!.completedAt).not.toBeNull();
      expect(servicesStep!.completed).toBe(false);
      expect(servicesStep!.completedAt).toBeNull();
    });

    it('should set allCompleted to true when all steps are done', async () => {
      const tenant = await createTenant();

      const steps: Array<'company_profile' | 'services_setup' | 'location_setup' | 'first_client' | 'first_appointment' | 'public_page_activation' | 'first_review_received'> = [
        'company_profile',
        'services_setup',
        'location_setup',
        'first_client',
        'first_appointment',
        'public_page_activation',
        'first_review_received',
      ];

      for (const step of steps) {
        await OnboardingService.completeStep(tenant.id, step);
      }

      const progress = await OnboardingService.getProgress(tenant.id);

      expect(progress.allCompleted).toBe(true);
      expect(progress.completenessPercent).toBe(100);
    });

    it('should include title and description for each step', async () => {
      const tenant = await createTenant();

      const progress = await OnboardingService.getProgress(tenant.id);

      for (const step of progress.steps) {
        expect(step.title).toBeDefined();
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.description).toBeDefined();
        expect(step.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateCompleteness', () => {
    it('should return 0 for no completed steps', () => {
      expect(calculateCompleteness([])).toBe(0);
    });

    it('should return correct weight for single step', () => {
      expect(calculateCompleteness(['COMPANY_PROFILE'])).toBe(20);
      expect(calculateCompleteness(['FIRST_REVIEW_RECEIVED'])).toBe(5);
    });

    it('should return 100 for all steps completed', () => {
      const allSteps: OnboardingStepKey[] = [
        'COMPANY_PROFILE',
        'SERVICES_SETUP',
        'LOCATION_SETUP',
        'FIRST_CLIENT',
        'FIRST_APPOINTMENT',
        'PUBLIC_PAGE_ACTIVATION',
        'FIRST_REVIEW_RECEIVED',
      ];
      expect(calculateCompleteness(allSteps)).toBe(100);
    });

    it('should sum weights correctly for partial completion', () => {
      // COMPANY_PROFILE (20) + LOCATION_SETUP (15) = 35
      expect(calculateCompleteness(['COMPANY_PROFILE', 'LOCATION_SETUP'])).toBe(35);
    });
  });

  describe('persistWithRetry', () => {
    it('should succeed on first attempt when operation succeeds', async () => {
      const result = await persistWithRetry(async () => 'ok');

      expect(result.success).toBe(true);
      expect(result.result).toBe('ok');
      expect(result.attempts).toBe(1);
    });

    it('should retry and succeed on second attempt', async () => {
      let callCount = 0;
      const result = await persistWithRetry(
        async () => {
          callCount++;
          if (callCount === 1) throw new Error('transient failure');
          return 'ok';
        },
        { maxRetries: 3, baseDelayMs: 10, backoffMultiplier: 2 },
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('ok');
      expect(result.attempts).toBe(2);
    });

    it('should fail after exhausting all retries', async () => {
      const result = await persistWithRetry(
        async () => {
          throw new Error('persistent failure');
        },
        { maxRetries: 3, baseDelayMs: 10, backoffMultiplier: 2 },
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.result).toBeUndefined();
    });
  });
});
