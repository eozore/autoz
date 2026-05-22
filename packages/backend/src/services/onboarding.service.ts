import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { OnboardingStepKey } from '../generated/prisma/enums';

// --- Types ---

export type OnboardingStepKeyApi =
  | 'company_profile'
  | 'services_setup'
  | 'location_setup'
  | 'first_client'
  | 'first_appointment'
  | 'public_page_activation'
  | 'first_review_received';

export interface OnboardingStep {
  key: OnboardingStepKeyApi;
  title: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
}

export interface OnboardingProgressResponse {
  steps: OnboardingStep[];
  completenessPercent: number;
  allCompleted: boolean;
}

export interface CompleteStepResponse {
  success: boolean;
  step: OnboardingStep;
  completenessPercent: number;
}

// --- Constants ---

const ONBOARDING_WEIGHTS: Record<OnboardingStepKey, number> = {
  COMPANY_PROFILE: 20,
  SERVICES_SETUP: 20,
  LOCATION_SETUP: 15,
  FIRST_CLIENT: 15,
  FIRST_APPOINTMENT: 15,
  PUBLIC_PAGE_ACTIVATION: 10,
  FIRST_REVIEW_RECEIVED: 5,
};

const STEP_METADATA: Record<OnboardingStepKey, { title: string; description: string }> = {
  COMPANY_PROFILE: {
    title: 'Perfil da Empresa',
    description: 'Configure o nome, logo e descrição da sua empresa',
  },
  SERVICES_SETUP: {
    title: 'Cadastro de Serviços',
    description: 'Adicione os serviços que sua oficina oferece',
  },
  LOCATION_SETUP: {
    title: 'Configurar Localização',
    description: 'Adicione o endereço e horário de funcionamento',
  },
  FIRST_CLIENT: {
    title: 'Primeiro Cliente',
    description: 'Cadastre seu primeiro cliente na plataforma',
  },
  FIRST_APPOINTMENT: {
    title: 'Primeiro Agendamento',
    description: 'Crie seu primeiro agendamento de serviço',
  },
  PUBLIC_PAGE_ACTIVATION: {
    title: 'Ativar Página Pública',
    description: 'Publique sua página para receber clientes online',
  },
  FIRST_REVIEW_RECEIVED: {
    title: 'Primeira Avaliação',
    description: 'Receba sua primeira avaliação de um cliente',
  },
};

// All steps in display order
const ALL_STEPS: OnboardingStepKey[] = [
  'COMPANY_PROFILE',
  'SERVICES_SETUP',
  'LOCATION_SETUP',
  'FIRST_CLIENT',
  'FIRST_APPOINTMENT',
  'PUBLIC_PAGE_ACTIVATION',
  'FIRST_REVIEW_RECEIVED',
];

// --- Retry Logic ---

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  backoffMultiplier: 2,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function persistWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<{ success: boolean; result?: T; attempts: number }> {
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await operation();
      return { success: true, result, attempts: attempt };
    } catch (error) {
      if (attempt === config.maxRetries) {
        logger.warn('Retry exhausted', {
          attempts: attempt,
          error: String(error),
        });
        return { success: false, attempts: attempt };
      }
      const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
      logger.warn('Retrying operation', {
        attempt,
        nextDelayMs: delay,
        error: String(error),
      });
      await sleep(delay);
    }
  }
  return { success: false, attempts: config.maxRetries };
}

// --- Helpers ---

function enumKeyToApiKey(key: OnboardingStepKey): OnboardingStepKeyApi {
  return key.toLowerCase() as OnboardingStepKeyApi;
}

function apiKeyToEnumKey(key: OnboardingStepKeyApi): OnboardingStepKey {
  return key.toUpperCase() as OnboardingStepKey;
}

export function calculateCompleteness(
  completedSteps: OnboardingStepKey[],
  weights: Record<OnboardingStepKey, number> = ONBOARDING_WEIGHTS,
): number {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;
  const completedWeight = completedSteps.reduce(
    (sum, step) => sum + (weights[step] || 0),
    0,
  );
  return Math.round((completedWeight / totalWeight) * 100);
}

// --- Service ---

export const OnboardingService = {
  /**
   * Complete an onboarding step for a tenant with retry logic.
   */
  async completeStep(
    tenantId: string,
    stepKey: OnboardingStepKeyApi,
  ): Promise<CompleteStepResponse> {
    const enumKey = apiKeyToEnumKey(stepKey);
    const now = new Date();

    const retryResult = await persistWithRetry(async () => {
      return prisma.onboardingProgress.upsert({
        where: {
          tenant_id_step: {
            tenant_id: tenantId,
            step: enumKey,
          },
        },
        update: {
          completed: true,
          completed_at: now,
        },
        create: {
          tenant_id: tenantId,
          step: enumKey,
          completed: true,
          completed_at: now,
        },
      });
    });

    if (!retryResult.success) {
      return {
        success: false,
        step: {
          key: stepKey,
          title: STEP_METADATA[enumKey].title,
          description: STEP_METADATA[enumKey].description,
          completed: false,
          completedAt: null,
        },
        completenessPercent: 0,
      };
    }

    // Fetch all progress to calculate completeness
    const allProgress = await prisma.onboardingProgress.findMany({
      where: { tenant_id: tenantId, completed: true },
    });

    const completedSteps = allProgress.map((p) => p.step);
    const completenessPercent = calculateCompleteness(completedSteps);

    return {
      success: true,
      step: {
        key: stepKey,
        title: STEP_METADATA[enumKey].title,
        description: STEP_METADATA[enumKey].description,
        completed: true,
        completedAt: now.toISOString(),
      },
      completenessPercent,
    };
  },

  /**
   * Get the full onboarding progress for a tenant.
   * Auto-syncs progress by checking real data in the database.
   */
  async getProgress(tenantId: string): Promise<OnboardingProgressResponse> {
    // Auto-sync: detect completed steps from real data
    await this._syncProgress(tenantId);

    const progressRecords = await prisma.onboardingProgress.findMany({
      where: { tenant_id: tenantId },
    });

    const progressMap = new Map(
      progressRecords.map((p) => [p.step, p]),
    );

    const steps: OnboardingStep[] = ALL_STEPS.map((enumKey) => {
      const record = progressMap.get(enumKey);
      return {
        key: enumKeyToApiKey(enumKey),
        title: STEP_METADATA[enumKey].title,
        description: STEP_METADATA[enumKey].description,
        completed: record?.completed ?? false,
        completedAt: record?.completed_at?.toISOString() ?? null,
      };
    });

    const completedSteps = progressRecords
      .filter((p) => p.completed)
      .map((p) => p.step);

    const completenessPercent = calculateCompleteness(completedSteps);
    const allCompleted = completedSteps.length === ALL_STEPS.length;

    return {
      steps,
      completenessPercent,
      allCompleted,
    };
  },

  /**
   * Auto-sync onboarding progress by checking real data in the database.
   * Marks steps as completed if the corresponding data exists.
   */
  async _syncProgress(tenantId: string): Promise<void> {
    try {
      const [
        companyCount,
        serviceCount,
        locationCount,
        clientCount,
        appointmentCount,
        reviewCount,
      ] = await Promise.all([
        prisma.company.count({ where: { tenant_id: tenantId } }),
        prisma.service.count({ where: { tenant_id: tenantId } }),
        prisma.location.count({ where: { tenant_id: tenantId } }),
        prisma.client.count({ where: { tenant_id: tenantId } }),
        prisma.appointment.count({ where: { tenant_id: tenantId } }),
        prisma.review.count({ where: { tenant_id: tenantId } }),
      ]);

      const detectedSteps: Array<{ step: OnboardingStepKey; completed: boolean }> = [
        { step: 'COMPANY_PROFILE', completed: companyCount > 0 },
        { step: 'SERVICES_SETUP', completed: serviceCount >= 1 },
        { step: 'LOCATION_SETUP', completed: locationCount >= 1 },
        { step: 'FIRST_CLIENT', completed: clientCount >= 1 },
        { step: 'FIRST_APPOINTMENT', completed: appointmentCount >= 1 },
        { step: 'PUBLIC_PAGE_ACTIVATION', completed: companyCount > 0 && locationCount > 0 && serviceCount > 0 },
        { step: 'FIRST_REVIEW_RECEIVED', completed: reviewCount >= 1 },
      ];

      const now = new Date();

      // Upsert only steps that are detected as completed
      for (const { step, completed } of detectedSteps) {
        if (completed) {
          await prisma.onboardingProgress.upsert({
            where: { tenant_id_step: { tenant_id: tenantId, step } },
            update: { completed: true, completed_at: now },
            create: { tenant_id: tenantId, step, completed: true, completed_at: now },
          });
        }
      }
    } catch (error) {
      // Non-blocking — if sync fails, just use existing progress records
      logger.warn('Onboarding sync failed', { tenantId, error: String(error) });
    }
  },
};
