import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { generateTestJwt, authHeader } from '../test/helpers';
import { prisma } from '../test/setup';
import { createFullTenantSetup } from '../test/factories';
import { Role } from '../generated/prisma/enums';

describe('Onboarding Routes', () => {
  describe('GET /onboarding/progress', () => {
    it('should return all 7 steps with default uncompleted state', async () => {
      const { user } = await createFullTenantSetup();
      const token = generateTestJwt({
        user_id: user.id,
        tenant_id: user.tenant_id!,
        role: Role.OWNER,
      });

      const res = await request(app)
        .get('/onboarding/progress')
        .set('Authorization', authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.steps).toHaveLength(7);
      expect(res.body.completenessPercent).toBe(0);
      expect(res.body.allCompleted).toBe(false);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/onboarding/progress');
      expect(res.status).toBe(401);
    });

    it('should reflect completed steps', async () => {
      const { user, tenant } = await createFullTenantSetup();
      const token = generateTestJwt({
        user_id: user.id,
        tenant_id: tenant.id,
        role: Role.OWNER,
      });

      // Complete a step directly in DB
      await prisma.onboardingProgress.create({
        data: {
          tenant_id: tenant.id,
          step: 'COMPANY_PROFILE',
          completed: true,
          completed_at: new Date(),
        },
      });

      const res = await request(app)
        .get('/onboarding/progress')
        .set('Authorization', authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.completenessPercent).toBe(20);
      const companyStep = res.body.steps.find(
        (s: { key: string }) => s.key === 'company_profile',
      );
      expect(companyStep.completed).toBe(true);
      expect(companyStep.completedAt).not.toBeNull();
    });
  });

  describe('POST /onboarding/complete-step', () => {
    it('should complete a valid step', async () => {
      const { user, tenant } = await createFullTenantSetup();
      const token = generateTestJwt({
        user_id: user.id,
        tenant_id: tenant.id,
        role: Role.OWNER,
      });

      const res = await request(app)
        .post('/onboarding/complete-step')
        .set('Authorization', authHeader(token))
        .send({ step: 'company_profile' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.step.key).toBe('company_profile');
      expect(res.body.step.completed).toBe(true);
      expect(res.body.completenessPercent).toBe(20);
    });

    it('should return 400 for invalid step', async () => {
      const { user, tenant } = await createFullTenantSetup();
      const token = generateTestJwt({
        user_id: user.id,
        tenant_id: tenant.id,
        role: Role.OWNER,
      });

      const res = await request(app)
        .post('/onboarding/complete-step')
        .set('Authorization', authHeader(token))
        .send({ step: 'invalid_step' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dados inválidos');
    });

    it('should return 400 for missing step field', async () => {
      const { user, tenant } = await createFullTenantSetup();
      const token = generateTestJwt({
        user_id: user.id,
        tenant_id: tenant.id,
        role: Role.OWNER,
      });

      const res = await request(app)
        .post('/onboarding/complete-step')
        .set('Authorization', authHeader(token))
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/onboarding/complete-step')
        .send({ step: 'company_profile' });
      expect(res.status).toBe(401);
    });
  });
});

describe('Gamification Routes', () => {
  describe('GET /gamification/badges', () => {
    it('should return badges response with empty state', async () => {
      const { user, tenant } = await createFullTenantSetup();
      const token = generateTestJwt({
        user_id: user.id,
        tenant_id: tenant.id,
        role: Role.OWNER,
      });

      const res = await request(app)
        .get('/gamification/badges')
        .set('Authorization', authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('badges');
      expect(res.body).toHaveProperty('profileCompleteness');
      expect(res.body).toHaveProperty('weeklyEngagement');
      expect(res.body.badges).toEqual([]);
      expect(res.body.profileCompleteness).toBe(0);
      expect(res.body.weeklyEngagement).toHaveProperty('currentWeek');
      expect(res.body.weeklyEngagement).toHaveProperty('previousWeek');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/gamification/badges');
      expect(res.status).toBe(401);
    });

    it('should reflect profile completeness from onboarding progress', async () => {
      const { user, tenant } = await createFullTenantSetup();
      const token = generateTestJwt({
        user_id: user.id,
        tenant_id: tenant.id,
        role: Role.OWNER,
      });

      // Complete some onboarding steps
      await prisma.onboardingProgress.createMany({
        data: [
          { tenant_id: tenant.id, step: 'COMPANY_PROFILE', completed: true, completed_at: new Date() },
          { tenant_id: tenant.id, step: 'SERVICES_SETUP', completed: true, completed_at: new Date() },
        ],
      });

      const res = await request(app)
        .get('/gamification/badges')
        .set('Authorization', authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.profileCompleteness).toBe(40);
    });
  });
});
