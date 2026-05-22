import { describe, it, expect } from 'vitest';
import { prisma } from '../test/setup';
import { createTenant, createFullTenantSetup, createAppointment } from '../test/factories';
import {
  ReviewService,
  reviewSchema,
  calculateAggregateRating,
} from '../services/review.service';
import { randomUUID } from 'crypto';

describe('ReviewService', () => {
  describe('reviewSchema validation', () => {
    it('should accept valid review data', () => {
      const result = reviewSchema.safeParse({
        appointment_id: randomUUID(),
        rating: 5,
        comment: 'Excelente serviço, muito profissional!',
        customer_name: 'João Silva',
        vehicle_description: 'Honda Civic 2020',
      });
      expect(result.success).toBe(true);
    });

    it('should reject rating below 1', () => {
      const result = reviewSchema.safeParse({
        appointment_id: randomUUID(),
        rating: 0,
        comment: 'Comentário válido com mais de dez caracteres',
        customer_name: 'João',
        vehicle_description: 'Carro',
      });
      expect(result.success).toBe(false);
    });

    it('should reject rating above 5', () => {
      const result = reviewSchema.safeParse({
        appointment_id: randomUUID(),
        rating: 6,
        comment: 'Comentário válido com mais de dez caracteres',
        customer_name: 'João',
        vehicle_description: 'Carro',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer rating', () => {
      const result = reviewSchema.safeParse({
        appointment_id: randomUUID(),
        rating: 3.5,
        comment: 'Comentário válido com mais de dez caracteres',
        customer_name: 'João',
        vehicle_description: 'Carro',
      });
      expect(result.success).toBe(false);
    });

    it('should reject comment shorter than 10 characters', () => {
      const result = reviewSchema.safeParse({
        appointment_id: randomUUID(),
        rating: 4,
        comment: 'Curto',
        customer_name: 'João',
        vehicle_description: 'Carro',
      });
      expect(result.success).toBe(false);
    });

    it('should reject comment longer than 500 characters', () => {
      const result = reviewSchema.safeParse({
        appointment_id: randomUUID(),
        rating: 4,
        comment: 'a'.repeat(501),
        customer_name: 'João',
        vehicle_description: 'Carro',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty customer_name', () => {
      const result = reviewSchema.safeParse({
        appointment_id: randomUUID(),
        rating: 4,
        comment: 'Comentário válido com mais de dez caracteres',
        customer_name: '',
        vehicle_description: 'Carro',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty vehicle_description', () => {
      const result = reviewSchema.safeParse({
        appointment_id: randomUUID(),
        rating: 4,
        comment: 'Comentário válido com mais de dez caracteres',
        customer_name: 'João',
        vehicle_description: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID for appointment_id', () => {
      const result = reviewSchema.safeParse({
        appointment_id: 'not-a-uuid',
        rating: 4,
        comment: 'Comentário válido com mais de dez caracteres',
        customer_name: 'João',
        vehicle_description: 'Carro',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createReview', () => {
    it('should create a review for a valid appointment', async () => {
      const { tenant, location } = await createFullTenantSetup();
      const appointment = await createAppointment({
        tenantId: tenant.id,
        locationId: location.id,
      });

      const result = await ReviewService.createReview(tenant.id, {
        appointment_id: appointment.id,
        rating: 5,
        comment: 'Excelente serviço, muito profissional!',
        customer_name: 'Maria Santos',
        vehicle_description: 'Toyota Corolla 2021',
      });

      expect(result.success).toBe(true);
      expect(result.review).toBeDefined();
      expect(result.review!.rating).toBe(5);
      expect(result.review!.customerName).toBe('Maria Santos');
      expect(result.review!.isPlaceholder).toBe(false);
    });

    it('should reject review with invalid data', async () => {
      const tenant = await createTenant();

      const result = await ReviewService.createReview(tenant.id, {
        appointment_id: randomUUID(),
        rating: 6,
        comment: 'Short',
        customer_name: '',
        vehicle_description: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject review for non-existent appointment', async () => {
      const tenant = await createTenant();

      const result = await ReviewService.createReview(tenant.id, {
        appointment_id: randomUUID(),
        rating: 4,
        comment: 'Bom serviço, recomendo para todos!',
        customer_name: 'Carlos',
        vehicle_description: 'Fiat Uno 2018',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agendamento não encontrado');
    });

    it('should reject duplicate review for same appointment', async () => {
      const { tenant, location } = await createFullTenantSetup();
      const appointment = await createAppointment({
        tenantId: tenant.id,
        locationId: location.id,
      });

      await ReviewService.createReview(tenant.id, {
        appointment_id: appointment.id,
        rating: 5,
        comment: 'Primeira avaliação muito boa!',
        customer_name: 'Ana',
        vehicle_description: 'VW Golf 2020',
      });

      const result = await ReviewService.createReview(tenant.id, {
        appointment_id: appointment.id,
        rating: 3,
        comment: 'Tentando avaliar novamente aqui',
        customer_name: 'Ana',
        vehicle_description: 'VW Golf 2020',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Este agendamento já possui uma avaliação');
    });
  });

  describe('getPublicReviews', () => {
    it('should return placeholder reviews when fewer than 3 real reviews exist', async () => {
      const tenant = await createTenant();

      const response = await ReviewService.getPublicReviews(tenant.id);

      expect(response.isPlaceholder).toBe(true);
      expect(response.reviews.length).toBe(3);
      expect(response.reviews.every((r) => r.isPlaceholder)).toBe(true);
      expect(response.totalCount).toBe(0);
    });

    it('should return real reviews when 3 or more exist', async () => {
      const { tenant, location } = await createFullTenantSetup();

      // Create 3 appointments and reviews
      for (let i = 0; i < 3; i++) {
        const appointment = await createAppointment({
          tenantId: tenant.id,
          locationId: location.id,
        });
        await ReviewService.createReview(tenant.id, {
          appointment_id: appointment.id,
          rating: 4 + (i % 2),
          comment: `Avaliação número ${i + 1} com texto suficiente`,
          customer_name: `Cliente ${i + 1}`,
          vehicle_description: `Carro ${i + 1}`,
        });
      }

      const response = await ReviewService.getPublicReviews(tenant.id);

      expect(response.isPlaceholder).toBe(false);
      expect(response.reviews.length).toBe(3);
      expect(response.reviews.every((r) => !r.isPlaceholder)).toBe(true);
      expect(response.totalCount).toBe(3);
    });

    it('should sort reviews by most recent first', async () => {
      const { tenant, location } = await createFullTenantSetup();

      const appointments = [];
      for (let i = 0; i < 3; i++) {
        const appointment = await createAppointment({
          tenantId: tenant.id,
          locationId: location.id,
        });
        appointments.push(appointment);
      }

      // Create reviews with slight delay to ensure ordering
      for (let i = 0; i < 3; i++) {
        await ReviewService.createReview(tenant.id, {
          appointment_id: appointments[i].id,
          rating: i + 3,
          comment: `Avaliação criada na posição ${i + 1} do loop`,
          customer_name: `Cliente ${i + 1}`,
          vehicle_description: `Carro ${i + 1}`,
        });
      }

      const response = await ReviewService.getPublicReviews(tenant.id);

      // Most recent should be first
      for (let i = 0; i < response.reviews.length - 1; i++) {
        const current = new Date(response.reviews[i].createdAt).getTime();
        const next = new Date(response.reviews[i + 1].createdAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('should include aggregate rating', async () => {
      const { tenant, location } = await createFullTenantSetup();

      const ratings = [3, 4, 5];
      for (let i = 0; i < 3; i++) {
        const appointment = await createAppointment({
          tenantId: tenant.id,
          locationId: location.id,
        });
        await ReviewService.createReview(tenant.id, {
          appointment_id: appointment.id,
          rating: ratings[i],
          comment: `Avaliação com nota ${ratings[i]} estrelas`,
          customer_name: `Cliente ${i + 1}`,
          vehicle_description: `Carro ${i + 1}`,
        });
      }

      const response = await ReviewService.getPublicReviews(tenant.id);

      // (3 + 4 + 5) / 3 = 4.0
      expect(response.aggregateRating).toBe(4);
    });
  });

  describe('getAggregateRating', () => {
    it('should return null when no reviews exist', async () => {
      const tenant = await createTenant();

      const rating = await ReviewService.getAggregateRating(tenant.id);

      expect(rating).toBeNull();
    });

    it('should return correct aggregate for existing reviews', async () => {
      const { tenant, location } = await createFullTenantSetup();

      const ratings = [4, 5, 3, 5];
      for (const r of ratings) {
        const appointment = await createAppointment({
          tenantId: tenant.id,
          locationId: location.id,
        });
        await ReviewService.createReview(tenant.id, {
          appointment_id: appointment.id,
          rating: r,
          comment: `Avaliação com nota ${r} para teste`,
          customer_name: 'Cliente Teste',
          vehicle_description: 'Carro Teste',
        });
      }

      const rating = await ReviewService.getAggregateRating(tenant.id);

      // (4 + 5 + 3 + 5) / 4 = 4.25 → rounded to 4.3
      expect(rating).toBe(4.3);
    });
  });

  describe('calculateAggregateRating', () => {
    it('should return null for empty array', () => {
      expect(calculateAggregateRating([])).toBeNull();
    });

    it('should return the single rating for one element', () => {
      expect(calculateAggregateRating([5])).toBe(5);
    });

    it('should calculate correct mean rounded to 1 decimal', () => {
      // (4 + 5 + 3) / 3 = 4.0
      expect(calculateAggregateRating([4, 5, 3])).toBe(4);
      // (1 + 2 + 3 + 4 + 5) / 5 = 3.0
      expect(calculateAggregateRating([1, 2, 3, 4, 5])).toBe(3);
      // (4 + 5 + 4 + 5 + 3) / 5 = 4.2
      expect(calculateAggregateRating([4, 5, 4, 5, 3])).toBe(4.2);
    });

    it('should round to one decimal place', () => {
      // (1 + 1 + 5) / 3 = 2.333... → 2.3
      expect(calculateAggregateRating([1, 1, 5])).toBe(2.3);
      // (5 + 5 + 4) / 3 = 4.666... → 4.7
      expect(calculateAggregateRating([5, 5, 4])).toBe(4.7);
    });
  });
});
