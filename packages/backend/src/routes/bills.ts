import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { createBillSchema, updateBillSchema } from '../schemas/bill';
import { ZodError } from 'zod';
import { BillStatus } from '../generated/prisma/enums';

const router = Router();

/**
 * POST /bills — Create a new bill with status PENDENTE.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createBillSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;

    const bill = await prisma.bill.create({
      data: {
        tenant_id: tenantId,
        descricao: data.descricao,
        valor: data.valor,
        data_vencimento: new Date(data.data_vencimento),
        status: BillStatus.PENDENTE,
      },
    });

    res.status(201).json(bill);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Create bill error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /bills — List bills with optional status and date range filters, cursor-based pagination.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string | undefined;
    const startDate = req.query.start as string | undefined;
    const endDate = req.query.end as string | undefined;

    const where: Record<string, unknown> = { tenant_id: tenantId };

    if (status && ['PENDENTE', 'PAGO', 'ATRASADO'].includes(status)) {
      where.status = status as BillStatus;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.data_vencimento = dateFilter;
    }

    const bills = await prisma.bill.findMany({
      where,
      orderBy: { data_vencimento: 'asc' },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const hasMore = bills.length > limit;
    const data = hasMore ? bills.slice(0, limit) : bills;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    res.status(200).json({ data, nextCursor });
  } catch (err) {
    logger.error('List bills error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


/**
 * PUT /bills/:billId — Update a bill.
 */
router.put('/:billId', async (req: Request<{ billId: string }>, res: Response) => {
  try {
    const data = updateBillSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;
    const billId = req.params.billId;

    const bill = await prisma.bill.findUnique({ where: { id: billId } });

    if (!bill || bill.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Conta não encontrada' });
      return;
    }

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: {
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(data.valor !== undefined && { valor: data.valor }),
        ...(data.data_vencimento !== undefined && {
          data_vencimento: new Date(data.data_vencimento),
        }),
      },
    });

    res.status(200).json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Update bill error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PATCH /bills/:billId/pay — Mark a bill as paid.
 */
router.patch('/:billId/pay', async (req: Request<{ billId: string }>, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const billId = req.params.billId;

    const bill = await prisma.bill.findUnique({ where: { id: billId } });

    if (!bill || bill.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Conta não encontrada' });
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: {
        status: BillStatus.PAGO,
        data_pagamento: today,
      },
    });

    res.status(200).json(updated);
  } catch (err) {
    logger.error('Pay bill error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /bills/:billId — Delete a bill.
 */
router.delete('/:billId', async (req: Request<{ billId: string }>, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const billId = req.params.billId;

    const bill = await prisma.bill.findUnique({ where: { id: billId } });

    if (!bill || bill.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Conta não encontrada' });
      return;
    }

    await prisma.bill.delete({ where: { id: billId } });

    res.status(204).send();
  } catch (err) {
    logger.error('Delete bill error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
