import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

// --- Interfaces ---

export interface LiquidityResponse {
  completedThisMonth: number;
  avgResponseTimeMinutes: number | null;
  isColdStart: boolean;
  totalCompleted: number;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface PublicFAQsResponse {
  faqs: FAQ[];
  isFallback: boolean;
}

export interface CreateFAQRequest {
  question: string;
  answer: string;
  sortOrder?: number;
}

export interface UpdateFAQRequest {
  question?: string;
  answer?: string;
  sortOrder?: number;
}

// --- Cold Start Configuration ---

export const COLD_START_CONFIG = {
  reviewThreshold: 3,
  liquidityThreshold: 5,
  demandThreshold: 10,
} as const;

/**
 * Determines whether real data should be shown based on completed count vs threshold.
 */
export function shouldShowRealData(completedCount: number, threshold: number): boolean {
  return completedCount >= threshold;
}

// --- Fallback FAQ Content ---

const FALLBACK_FAQS: FAQ[] = [
  {
    id: 'fallback-1',
    question: 'Como agendar um serviço?',
    answer:
      'Basta escolher o serviço desejado na nossa página, selecionar a data e horário disponíveis, e confirmar o agendamento. Você receberá uma confirmação por WhatsApp.',
    sortOrder: 1,
  },
  {
    id: 'fallback-2',
    question: 'Quais formas de pagamento são aceitas?',
    answer:
      'Aceitamos dinheiro, cartão de crédito, cartão de débito e PIX. O pagamento é realizado diretamente na oficina após a conclusão do serviço.',
    sortOrder: 2,
  },
  {
    id: 'fallback-3',
    question: 'Quanto tempo demora o serviço?',
    answer:
      'O tempo varia de acordo com o serviço escolhido. Cada serviço tem uma estimativa de duração informada na página de agendamento.',
    sortOrder: 3,
  },
  {
    id: 'fallback-4',
    question: 'Posso cancelar ou reagendar?',
    answer:
      'Sim! Você pode cancelar ou reagendar seu atendimento entrando em contato conosco com pelo menos 2 horas de antecedência.',
    sortOrder: 4,
  },
  {
    id: 'fallback-5',
    question: 'Os serviços possuem garantia?',
    answer:
      'Sim, oferecemos garantia nos serviços realizados. O prazo de garantia varia conforme o tipo de serviço. Consulte as condições no momento do atendimento.',
    sortOrder: 5,
  },
];

// --- Service ---

export const ColdStartService = {
  /**
   * Get liquidity signals for a tenant's public page.
   * Returns completed count, avg response time, and cold start flag.
   */
  async getLiquiditySignals(tenantId: string): Promise<LiquidityResponse> {
    try {
      // Get total completed appointments
      const totalCompleted = await prisma.appointment.count({
        where: {
          tenant_id: tenantId,
          status: 'CONCLUIDO',
        },
      });

      // Get completed appointments this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const completedThisMonth = await prisma.appointment.count({
        where: {
          tenant_id: tenantId,
          status: 'CONCLUIDO',
          updated_at: { gte: startOfMonth },
        },
      });

      const isColdStart = !shouldShowRealData(totalCompleted, COLD_START_CONFIG.liquidityThreshold);

      // Calculate avg response time from last 30 confirmed appointments
      let avgResponseTimeMinutes: number | null = null;

      if (!isColdStart) {
        const confirmedAppointments = await prisma.appointment.findMany({
          where: {
            tenant_id: tenantId,
            status: { in: ['CONFIRMADO', 'EM_ANDAMENTO', 'CONCLUIDO'] },
          },
          orderBy: { updated_at: 'desc' },
          take: 30,
          select: {
            created_at: true,
            updated_at: true,
          },
        });

        if (confirmedAppointments.length > 0) {
          const totalMinutes = confirmedAppointments.reduce((sum, appt) => {
            const diffMs = appt.updated_at.getTime() - appt.created_at.getTime();
            return sum + diffMs / (1000 * 60);
          }, 0);
          avgResponseTimeMinutes = Math.round(totalMinutes / confirmedAppointments.length);
        }
      }

      return {
        completedThisMonth,
        avgResponseTimeMinutes,
        isColdStart,
        totalCompleted,
      };
    } catch (error: unknown) {
      logger.error('Failed to get liquidity signals', {
        tenantId,
        error: String(error),
      });
      return {
        completedThisMonth: 0,
        avgResponseTimeMinutes: null,
        isColdStart: true,
        totalCompleted: 0,
      };
    }
  },

  /**
   * Get public FAQs for a tenant.
   * Returns custom FAQs if any exist, otherwise returns fallback content.
   */
  async getPublicFAQs(tenantId: string): Promise<PublicFAQsResponse> {
    try {
      const customFaqs = await prisma.fAQ.findMany({
        where: { tenant_id: tenantId },
        orderBy: { sort_order: 'asc' },
      });

      if (customFaqs.length === 0) {
        return {
          faqs: FALLBACK_FAQS,
          isFallback: true,
        };
      }

      const faqs: FAQ[] = customFaqs.map((faq) => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        sortOrder: faq.sort_order,
      }));

      return {
        faqs,
        isFallback: false,
      };
    } catch (error: unknown) {
      logger.error('Failed to get public FAQs', {
        tenantId,
        error: String(error),
      });
      return {
        faqs: FALLBACK_FAQS,
        isFallback: true,
      };
    }
  },

  /**
   * Create a new FAQ entry for a tenant.
   */
  async createFAQ(
    tenantId: string,
    data: CreateFAQRequest,
  ): Promise<{ success: boolean; faq?: FAQ; error?: string }> {
    try {
      const created = await prisma.fAQ.create({
        data: {
          tenant_id: tenantId,
          question: data.question,
          answer: data.answer,
          sort_order: data.sortOrder ?? 0,
        },
      });

      return {
        success: true,
        faq: {
          id: created.id,
          question: created.question,
          answer: created.answer,
          sortOrder: created.sort_order,
        },
      };
    } catch (error: unknown) {
      logger.error('Failed to create FAQ', {
        tenantId,
        error: String(error),
      });
      return {
        success: false,
        error: 'Erro ao criar FAQ',
      };
    }
  },

  /**
   * Update an existing FAQ entry for a tenant.
   */
  async updateFAQ(
    tenantId: string,
    faqId: string,
    data: UpdateFAQRequest,
  ): Promise<{ success: boolean; faq?: FAQ; error?: string }> {
    try {
      // Verify the FAQ belongs to this tenant
      const existing = await prisma.fAQ.findFirst({
        where: { id: faqId, tenant_id: tenantId },
      });

      if (!existing) {
        return {
          success: false,
          error: 'FAQ não encontrada',
        };
      }

      const updated = await prisma.fAQ.update({
        where: { id: faqId },
        data: {
          ...(data.question !== undefined && { question: data.question }),
          ...(data.answer !== undefined && { answer: data.answer }),
          ...(data.sortOrder !== undefined && { sort_order: data.sortOrder }),
        },
      });

      return {
        success: true,
        faq: {
          id: updated.id,
          question: updated.question,
          answer: updated.answer,
          sortOrder: updated.sort_order,
        },
      };
    } catch (error: unknown) {
      logger.error('Failed to update FAQ', {
        tenantId,
        faqId,
        error: String(error),
      });
      return {
        success: false,
        error: 'Erro ao atualizar FAQ',
      };
    }
  },

  /**
   * Delete a FAQ entry for a tenant.
   */
  async deleteFAQ(
    tenantId: string,
    faqId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify the FAQ belongs to this tenant
      const existing = await prisma.fAQ.findFirst({
        where: { id: faqId, tenant_id: tenantId },
      });

      if (!existing) {
        return {
          success: false,
          error: 'FAQ não encontrada',
        };
      }

      await prisma.fAQ.delete({
        where: { id: faqId },
      });

      return { success: true };
    } catch (error: unknown) {
      logger.error('Failed to delete FAQ', {
        tenantId,
        faqId,
        error: String(error),
      });
      return {
        success: false,
        error: 'Erro ao excluir FAQ',
      };
    }
  },
};
