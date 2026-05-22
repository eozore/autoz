import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const router = Router();

const dismissTipSchema = z.object({
  pageKey: z.string().min(1),
});

/**
 * GET /settings/tips-dismissed — Get the list of dismissed tip page keys for the tenant.
 */
router.get('/tips-dismissed', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenant_id: tenantId },
      select: { tips_dismissed: true },
    });

    const tipsDismissed = (settings?.tips_dismissed as string[]) || [];
    res.status(200).json({ tips_dismissed: tipsDismissed });
  } catch (err) {
    logger.error('Get tips dismissed error', { error: String(err) });
    res.status(500).json({ error: 'Erro ao carregar configurações' });
  }
});

/**
 * POST /settings/dismiss-tip — Dismiss a contextual tip for a specific page.
 */
router.post('/dismiss-tip', async (req: Request, res: Response) => {
  try {
    const data = dismissTipSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;

    // Upsert tenant settings and add the page key to tips_dismissed array
    const existing = await prisma.tenantSettings.findUnique({
      where: { tenant_id: tenantId },
    });

    if (existing) {
      const currentDismissed = (existing.tips_dismissed as string[]) || [];
      if (!currentDismissed.includes(data.pageKey)) {
        await prisma.tenantSettings.update({
          where: { tenant_id: tenantId },
          data: {
            tips_dismissed: [...currentDismissed, data.pageKey],
          },
        });
      }
    } else {
      await prisma.tenantSettings.create({
        data: {
          tenant_id: tenantId,
          tips_dismissed: [data.pageKey],
        },
      });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Dismiss tip error', { error: String(err) });
    res.status(500).json({ error: 'Erro ao salvar configuração' });
  }
});

export default router;
