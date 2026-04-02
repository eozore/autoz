import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { createClientSchema, updateClientSchema } from '../schemas/client';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client';

const router = Router();

/**
 * POST /clients — Create a new client for the tenant.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createClientSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        nome: data.nome,
        email: data.email ?? null,
        celular: data.celular,
        data_nascimento: data.data_nascimento ? new Date(data.data_nascimento) : null,
      },
    });

    res.status(201).json(client);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta?.target as string[]) ?? [];
      if (target.includes('celular')) {
        res.status(409).json({ error: 'Celular já cadastrado neste estabelecimento' });
        return;
      }
      if (target.includes('email')) {
        res.status(409).json({ error: 'Email já cadastrado neste estabelecimento' });
        return;
      }
      res.status(409).json({ error: 'Registro duplicado' });
      return;
    }
    logger.error('Create client error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /clients — List clients for the tenant with cursor-based pagination.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const clients = await prisma.client.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'asc' },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      include: {
        _count: { select: { vehicles: true } },
      },
    });

    const hasMore = clients.length > limit;
    const data = hasMore ? clients.slice(0, limit) : clients;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    res.status(200).json({ data, nextCursor });
  } catch (err) {
    logger.error('List clients error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /clients/:clientId — Get a single client by ID.
 */
router.get('/:clientId', async (req: Request<{ clientId: string }>, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const clientId = req.params.clientId;

    const client = await prisma.client.findUnique({ where: { id: clientId } });

    if (!client || client.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    res.status(200).json(client);
  } catch (err) {
    logger.error('Get client error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /clients/:clientId — Update a client.
 */
router.put('/:clientId', async (req: Request<{ clientId: string }>, res: Response) => {
  try {
    const data = updateClientSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;
    const clientId = req.params.clientId;

    const client = await prisma.client.findUnique({ where: { id: clientId } });

    if (!client || client.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.celular !== undefined && { celular: data.celular }),
        ...(data.data_nascimento !== undefined && {
          data_nascimento: data.data_nascimento ? new Date(data.data_nascimento) : null,
        }),
      },
    });

    res.status(200).json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta?.target as string[]) ?? [];
      if (target.includes('celular')) {
        res.status(409).json({ error: 'Celular já cadastrado neste estabelecimento' });
        return;
      }
      if (target.includes('email')) {
        res.status(409).json({ error: 'Email já cadastrado neste estabelecimento' });
        return;
      }
      res.status(409).json({ error: 'Registro duplicado' });
      return;
    }
    logger.error('Update client error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /clients/:clientId — Delete a client.
 */
router.delete('/:clientId', async (req: Request<{ clientId: string }>, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const clientId = req.params.clientId;

    const client = await prisma.client.findUnique({ where: { id: clientId } });

    if (!client || client.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    await prisma.client.delete({ where: { id: clientId } });

    res.status(204).send();
  } catch (err) {
    logger.error('Delete client error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
