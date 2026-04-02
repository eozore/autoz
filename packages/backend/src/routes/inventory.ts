import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  createMovementSchema,
} from '../schemas/inventory';
import { ZodError } from 'zod';
import { ItemType, MovementType } from '../generated/prisma/enums';

const router = Router();

/**
 * POST /inventory — Create a new inventory item for the tenant.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createInventoryItemSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;

    const item = await prisma.inventoryItem.create({
      data: {
        tenant_id: tenantId,
        nome: data.nome,
        descricao: data.descricao ?? null,
        custo: data.custo,
        valor_venda: data.valor_venda,
        tipo: data.tipo as ItemType,
        quantidade_atual: data.quantidade_inicial,
        quantidade_minima: data.quantidade_minima ?? 0,
      },
    });

    res.status(201).json(item);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Create inventory item error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


/**
 * GET /inventory/summary — Return stock summary for the tenant.
 * Must be defined BEFORE /:itemId to avoid route conflicts.
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;

    const items = await prisma.inventoryItem.findMany({
      where: { tenant_id: tenantId },
      select: { tipo: true, quantidade_atual: true, quantidade_minima: true },
    });

    const total_items = items.length;
    const total_uso = items.filter((i) => i.tipo === ItemType.USO).length;
    const total_venda = items.filter((i) => i.tipo === ItemType.VENDA).length;
    const low_stock_count = items.filter(
      (i) => i.quantidade_atual <= i.quantidade_minima,
    ).length;

    res.status(200).json({ total_items, total_uso, total_venda, low_stock_count });
  } catch (err) {
    logger.error('Inventory summary error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /inventory — List inventory items with optional tipo filter and cursor-based pagination.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const tipo = req.query.tipo as string | undefined;

    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (tipo && (tipo === 'USO' || tipo === 'VENDA')) {
      where.tipo = tipo as ItemType;
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { created_at: 'asc' },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    res.status(200).json({ data, nextCursor });
  } catch (err) {
    logger.error('List inventory items error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /inventory/:itemId — Update an inventory item.
 */
router.put('/:itemId', async (req: Request<{ itemId: string }>, res: Response) => {
  try {
    const data = updateInventoryItemSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;
    const itemId = req.params.itemId;

    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });

    if (!item || item.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Item não encontrado' });
      return;
    }

    const updated = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(data.custo !== undefined && { custo: data.custo }),
        ...(data.valor_venda !== undefined && { valor_venda: data.valor_venda }),
        ...(data.quantidade_minima !== undefined && { quantidade_minima: data.quantidade_minima }),
      },
    });

    res.status(200).json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Update inventory item error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /inventory/:itemId — Delete an inventory item.
 */
router.delete('/:itemId', async (req: Request<{ itemId: string }>, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const itemId = req.params.itemId;

    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });

    if (!item || item.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Item não encontrado' });
      return;
    }

    await prisma.inventoryItem.delete({ where: { id: itemId } });

    res.status(204).send();
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2003') {
      res.status(409).json({ error: 'Não é possível excluir este item pois existem movimentações vinculadas.' });
      return;
    }
    logger.error('Delete inventory item error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /inventory/:itemId/movements — Create a stock movement (atomic transaction).
 */
router.post(
  '/:itemId/movements',
  async (req: Request<{ itemId: string }>, res: Response) => {
    try {
      const data = createMovementSchema.parse(req.body);
      const tenantId = req.context!.tenant_id!;
      const itemId = req.params.itemId;

      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });

      if (!item || item.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Item não encontrado' });
        return;
      }

      // Validate movement type against item type
      if (data.tipo === 'SAIDA_VENDA' && item.tipo !== ItemType.VENDA) {
        res.status(400).json({ error: 'SAIDA_VENDA só é permitida para itens do tipo VENDA' });
        return;
      }
      if (data.tipo === 'SAIDA_USO' && item.tipo !== ItemType.USO) {
        res.status(400).json({ error: 'SAIDA_USO só é permitida para itens do tipo USO' });
        return;
      }

      // Check sufficient stock for exits
      if (data.tipo !== 'ENTRADA' && item.quantidade_atual < data.quantidade) {
        res.status(422).json({
          error: `Estoque insuficiente. Disponível: ${item.quantidade_atual}`,
        });
        return;
      }

      // Calculate new quantity
      const delta = data.tipo === 'ENTRADA' ? data.quantidade : -data.quantidade;

      // Atomic transaction: create movement + update quantity
      const [movement, updatedItem] = await prisma.$transaction([
        prisma.stockMovement.create({
          data: {
            tenant_id: tenantId,
            item_id: itemId,
            tipo: data.tipo as MovementType,
            quantidade: data.quantidade,
            referencia_tipo: data.referencia_tipo ?? null,
            referencia_id: data.referencia_id ?? null,
            notas: data.notas ?? null,
          },
        }),
        prisma.inventoryItem.update({
          where: { id: itemId },
          data: { quantidade_atual: { increment: delta } },
        }),
      ]);

      // Log low stock alert
      if (updatedItem.quantidade_atual <= updatedItem.quantidade_minima) {
        logger.warn('Low stock alert', {
          item: updatedItem.nome,
          itemId: updatedItem.id,
          currentQty: updatedItem.quantidade_atual,
          minQty: updatedItem.quantidade_minima,
        });
      }

      res.status(201).json({ movement, item: updatedItem });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Dados inválidos', details: err.errors });
        return;
      }
      logger.error('Create stock movement error', { error: String(err) });
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

export default router;
