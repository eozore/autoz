import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

// --- Validation Schema ---

export const reviewSchema = z.object({
  appointment_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10, 'Comentário deve ter pelo menos 10 caracteres').max(500),
  customer_name: z.string().min(1),
  vehicle_description: z.string().min(1),
});

export type CreateReviewRequest = z.infer<typeof reviewSchema>;

// --- Interfaces ---

export interface Review {
  id: string;
  rating: number;
  comment: string;
  customerName: string;
  vehicleDescription: string;
  createdAt: string;
  isPlaceholder: boolean;
}

export interface PublicReviewsResponse {
  reviews: Review[];
  aggregateRating: number | null;
  totalCount: number;
  isPlaceholder: boolean;
}

// --- Constants ---

const COLD_START_REVIEW_THRESHOLD = 3;

const PLACEHOLDER_REVIEWS: Review[] = [
  {
    id: 'placeholder-1',
    rating: 5,
    comment: 'Excelente atendimento! Serviço rápido e de qualidade. Recomendo a todos.',
    customerName: 'Maria S.',
    vehicleDescription: 'Honda Civic 2020',
    createdAt: new Date().toISOString(),
    isPlaceholder: true,
  },
  {
    id: 'placeholder-2',
    rating: 4,
    comment: 'Muito bom! Profissionais atenciosos e preço justo. Voltarei com certeza.',
    customerName: 'João P.',
    vehicleDescription: 'Toyota Corolla 2019',
    createdAt: new Date().toISOString(),
    isPlaceholder: true,
  },
  {
    id: 'placeholder-3',
    rating: 5,
    comment: 'Serviço impecável, entregaram o carro no prazo combinado. Nota máxima!',
    customerName: 'Carlos M.',
    vehicleDescription: 'Volkswagen Golf 2021',
    createdAt: new Date().toISOString(),
    isPlaceholder: true,
  },
];

// --- Algorithms ---

export function calculateAggregateRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

// --- Service ---

export const ReviewService = {
  /**
   * Create a new review for a tenant's appointment.
   * Validates input with Zod schema before persisting.
   */
  async createReview(
    tenantId: string,
    data: CreateReviewRequest,
  ): Promise<{ success: boolean; review?: Review; error?: string }> {
    // Validate input
    const validation = reviewSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      return {
        success: false,
        error: firstError?.message || 'Dados inválidos',
      };
    }

    const validData = validation.data;

    try {
      // Verify the appointment belongs to this tenant
      const appointment = await prisma.appointment.findFirst({
        where: {
          id: validData.appointment_id,
          tenant_id: tenantId,
        },
      });

      if (!appointment) {
        return {
          success: false,
          error: 'Agendamento não encontrado',
        };
      }

      // Check if a review already exists for this appointment
      const existingReview = await prisma.review.findUnique({
        where: { appointment_id: validData.appointment_id },
      });

      if (existingReview) {
        return {
          success: false,
          error: 'Este agendamento já possui uma avaliação',
        };
      }

      const created = await prisma.review.create({
        data: {
          tenant_id: tenantId,
          appointment_id: validData.appointment_id,
          rating: validData.rating,
          comment: validData.comment,
          customer_name: validData.customer_name,
          vehicle_description: validData.vehicle_description,
        },
      });

      return {
        success: true,
        review: {
          id: created.id,
          rating: created.rating,
          comment: created.comment,
          customerName: created.customer_name,
          vehicleDescription: created.vehicle_description,
          createdAt: created.created_at.toISOString(),
          isPlaceholder: false,
        },
      };
    } catch (error: unknown) {
      logger.error('Failed to create review', {
        tenantId,
        appointmentId: validData.appointment_id,
        error: String(error),
      });
      return {
        success: false,
        error: 'Erro ao salvar avaliação',
      };
    }
  },

  /**
   * Get public reviews for a tenant.
   * Returns placeholder testimonials when fewer than 3 real reviews exist.
   * Real reviews are sorted by most recent first.
   */
  async getPublicReviews(tenantId: string): Promise<PublicReviewsResponse> {
    try {
      const reviews = await prisma.review.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
      });

      const realReviewCount = reviews.length;
      const isPlaceholder = realReviewCount < COLD_START_REVIEW_THRESHOLD;

      if (isPlaceholder) {
        // No real reviews yet — return empty list (frontend hides the section)
        const aggregateRating = calculateAggregateRating(
          reviews.map((r) => r.rating),
        );

        return {
          reviews: [],
          aggregateRating,
          totalCount: realReviewCount,
          isPlaceholder: false,
        };
      }

      // Return real reviews sorted by most recent first
      const mappedReviews: Review[] = reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        customerName: r.customer_name,
        vehicleDescription: r.vehicle_description,
        createdAt: r.created_at.toISOString(),
        isPlaceholder: false,
      }));

      const aggregateRating = calculateAggregateRating(
        reviews.map((r) => r.rating),
      );

      return {
        reviews: mappedReviews,
        aggregateRating,
        totalCount: realReviewCount,
        isPlaceholder: false,
      };
    } catch (error: unknown) {
      logger.error('Failed to fetch public reviews', {
        tenantId,
        error: String(error),
      });
      return {
        reviews: [],
        aggregateRating: null,
        totalCount: 0,
        isPlaceholder: false,
      };
    }
  },

  /**
   * Get the aggregate rating for a tenant.
   * Returns null if no reviews exist.
   */
  async getAggregateRating(tenantId: string): Promise<number | null> {
    try {
      const reviews = await prisma.review.findMany({
        where: { tenant_id: tenantId },
        select: { rating: true },
      });

      return calculateAggregateRating(reviews.map((r) => r.rating));
    } catch (error: unknown) {
      logger.error('Failed to calculate aggregate rating', {
        tenantId,
        error: String(error),
      });
      return null;
    }
  },
};
