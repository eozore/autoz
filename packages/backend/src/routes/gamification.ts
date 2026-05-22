import { Router, Request, Response } from 'express';
import { GamificationService } from '../services/gamification.service';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /gamification/badges — Get badges, profile completeness, and weekly engagement.
 */
router.get('/badges', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const badgesResponse = await GamificationService.getBadgesResponse(tenantId);
    res.status(200).json(badgesResponse);
  } catch (err) {
    logger.error('Get gamification badges error', { error: String(err) });
    res.status(500).json({ error: 'Erro ao carregar badges' });
  }
});

export default router;
