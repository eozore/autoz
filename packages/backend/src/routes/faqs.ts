import { Router, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { ColdStartService } from '../services/cold-start.service';
import { logger } from '../lib/logger';

const router = Router();

const createFAQSchema = z.object({
  question: z.string().min(1, 'Pergunta é obrigatória'),
  answer: z.string().min(1, 'Resposta é obrigatória'),
  sortOrder: z.number().int().optional(),
});

/**
 * POST /faqs — Create a new FAQ entry for the authenticated tenant.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createFAQSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;

    const result = await ColdStartService.createFAQ(tenantId, data);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.status(201).json(result.faq);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Create FAQ error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
