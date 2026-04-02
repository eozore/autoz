import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { createServiceSchema, updateServiceSchema } from '../schemas/service';
import { ZodError } from 'zod';

const router = Router();

/**
 * POST /services — Create a new service for the tenant.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createServiceSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;

    const service = await prisma.service.create({
      data: {
        tenant_id: tenantId,
        nome: data.nome,
        descricao: data.descricao ?? null,
        foto_url: data.foto_url ?? null,
        duracao_minutos: data.duracao_minutos,
        valor: data.valor ?? null,
        ativo: data.ativo ?? true,
      },
    });

    res.status(201).json(service);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Create service error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /services — List all services for the tenant.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;

    const services = await prisma.service.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'asc' },
    });

    res.status(200).json(services);
  } catch (err) {
    logger.error('List services error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /services/:serviceId — Update a service.
 */
router.put('/:serviceId', async (req: Request<{ serviceId: string }>, res: Response) => {
  try {
    const data = updateServiceSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;
    const serviceId = req.params.serviceId;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });

    if (!service || service.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Serviço não encontrado' });
      return;
    }

    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(data.foto_url !== undefined && { foto_url: data.foto_url }),
        ...(data.duracao_minutos !== undefined && { duracao_minutos: data.duracao_minutos }),
        ...(data.valor !== undefined && { valor: data.valor }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
    });

    res.status(200).json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Update service error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /services/:serviceId — Delete a service.
 */
router.delete('/:serviceId', async (req: Request<{ serviceId: string }>, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const serviceId = req.params.serviceId;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });

    if (!service || service.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Serviço não encontrado' });
      return;
    }

    await prisma.service.delete({ where: { id: serviceId } });

    res.status(204).send();
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2003') {
      res.status(409).json({ error: 'Não é possível excluir este serviço pois existem agendamentos vinculados. Desative-o em vez de excluir.' });
      return;
    }
    logger.error('Delete service error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
