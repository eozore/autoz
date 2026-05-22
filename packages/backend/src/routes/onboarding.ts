import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import { OnboardingService } from '../services/onboarding.service';
import { GamificationService } from '../services/gamification.service';
import { completeStepSchema } from '../schemas/onboarding';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /onboarding/progress — Get onboarding progress for the authenticated tenant.
 */
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const progress = await OnboardingService.getProgress(tenantId);
    res.status(200).json(progress);
  } catch (err) {
    logger.error('Get onboarding progress error', { error: String(err) });
    res.status(500).json({ error: 'Erro ao carregar progresso de onboarding' });
  }
});

/**
 * POST /onboarding/complete-step — Mark an onboarding step as completed.
 */
router.post('/complete-step', async (req: Request, res: Response) => {
  try {
    const data = completeStepSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;

    const result = await OnboardingService.completeStep(tenantId, data.step);

    if (!result.success) {
      res.status(500).json({ error: 'Falha ao salvar progresso. Tente novamente.' });
      return;
    }

    // Check if completing this step awards any badges
    const newBadges = await GamificationService.checkAndAwardBadges(tenantId);
    const badgeAwarded = newBadges.length > 0 ? newBadges[0] : undefined;

    res.status(200).json({
      success: result.success,
      step: result.step,
      completenessPercent: result.completenessPercent,
      ...(badgeAwarded && { badgeAwarded }),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Complete onboarding step error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
