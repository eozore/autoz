import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppointmentStatus, BillStatus, MovementType } from '../generated/prisma/enums';
import { MetricsService } from '../services/metrics.service';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      servicesAgg,
      salesResult,
      inProgressAgg,
      installmentAgg,
      billsGrouped,
      overdueAgg,
      monthlyBillsAgg,
      monthlyPaidAgg,
      totalCompleted,
      stockCostResult,
      stockSaleResult,
    ] = await Promise.all([
      // Completed appointments this month (services revenue)
      prisma.appointment.aggregate({
        where: {
          tenant_id: tenantId,
          status: AppointmentStatus.CONCLUIDO,
          data_hora: { gte: monthStart, lte: monthEnd },
        },
        _sum: { valor_servico: true, desconto: true },
        _count: true,
      }),

      // Sales revenue this month (SAIDA_VENDA movements)
      prisma.$queryRaw<[{ total: number | null }]>`
        SELECT COALESCE(SUM(ii.valor_venda * sm.quantidade), 0)::float AS total
        FROM stock_movements sm
        JOIN inventory_items ii ON sm.item_id = ii.id
        WHERE sm.tenant_id = ${tenantId}
          AND sm.tipo = ${MovementType.SAIDA_VENDA}::"MovementType"
          AND sm.created_at >= ${monthStart}
          AND sm.created_at <= ${monthEnd}
      `,

      // Receivables: EM_ANDAMENTO appointments
      prisma.appointment.aggregate({
        where: {
          tenant_id: tenantId,
          status: AppointmentStatus.EM_ANDAMENTO,
        },
        _sum: { valor_servico: true, desconto: true },
        _count: true,
      }),

      // Receivables: CONCLUIDO + PARCELADO
      prisma.appointment.aggregate({
        where: {
          tenant_id: tenantId,
          status: AppointmentStatus.CONCLUIDO,
          forma_pagamento: 'PARCELADO',
        },
        _sum: { valor_servico: true, desconto: true },
        _count: true,
      }),

      // Bills summary: groupBy status
      prisma.bill.groupBy({
        by: ['status'],
        where: { tenant_id: tenantId },
        _sum: { valor: true },
        _count: true,
      }),

      // Overdue bills: PENDENTE with past due date
      prisma.bill.aggregate({
        where: {
          tenant_id: tenantId,
          status: BillStatus.PENDENTE,
          data_vencimento: { lt: now },
        },
        _sum: { valor: true },
        _count: true,
      }),

      // Monthly bills (due this month)
      prisma.bill.aggregate({
        where: {
          tenant_id: tenantId,
          data_vencimento: { gte: monthStart, lte: monthEnd },
        },
        _sum: { valor: true },
      }),

      // Monthly paid bills
      prisma.bill.aggregate({
        where: {
          tenant_id: tenantId,
          data_vencimento: { gte: monthStart, lte: monthEnd },
          status: BillStatus.PAGO,
        },
        _sum: { valor: true },
      }),

      // All-time completed appointments count
      prisma.appointment.count({
        where: { tenant_id: tenantId, status: AppointmentStatus.CONCLUIDO },
      }),

      // Inventory: stock cost total
      prisma.$queryRaw<[{ total: number | null }]>`
        SELECT COALESCE(SUM(custo * quantidade_atual), 0)::float AS total
        FROM inventory_items
        WHERE tenant_id = ${tenantId}
      `,

      // Inventory: stock sale value (VENDA items only)
      prisma.$queryRaw<[{ total: number | null }]>`
        SELECT COALESCE(SUM(valor_venda * quantidade_atual), 0)::float AS total
        FROM inventory_items
        WHERE tenant_id = ${tenantId}
          AND tipo = 'VENDA'::"ItemType"
      `,
    ]);

    const servicesRevenue =
      Number(servicesAgg._sum.valor_servico ?? 0) -
      Number(servicesAgg._sum.desconto ?? 0);

    const salesRevenue = Number(salesResult[0]?.total ?? 0);

    const inProgressTotal =
      Number(inProgressAgg._sum.valor_servico ?? 0) -
      Number(inProgressAgg._sum.desconto ?? 0);

    const installmentTotal =
      Number(installmentAgg._sum.valor_servico ?? 0) -
      Number(installmentAgg._sum.desconto ?? 0);

    const paidGroup = billsGrouped.find((g) => g.status === BillStatus.PAGO);
    const pendingGroup = billsGrouped.find((g) => g.status === BillStatus.PENDENTE);

    const totalPaid = Number(paidGroup?._sum.valor ?? 0);
    const totalPending = Number(pendingGroup?._sum.valor ?? 0);

    const totalOverdue = Number(overdueAgg._sum.valor ?? 0);

    const monthlyExpenses = Number(monthlyBillsAgg._sum.valor ?? 0);
    const monthlyPaid = Number(monthlyPaidAgg._sum.valor ?? 0);

    const stockCostTotal = Number(stockCostResult[0]?.total ?? 0);
    const stockSaleValue = Number(stockSaleResult[0]?.total ?? 0);

    res.json({
      month: {
        servicesCompleted: servicesAgg._count,
        salesRevenue,
        servicesRevenue,
        totalExpenses: monthlyExpenses,
        paidExpenses: monthlyPaid,
        pendingExpenses: monthlyExpenses - monthlyPaid,
        cashFlow: (salesRevenue + servicesRevenue) - monthlyPaid,
      },
      bills: {
        totalPaid,
        totalPending,
        totalOverdue,
        overdueCount: overdueAgg._count,
      },
      receivables: {
        inProgress: { count: inProgressAgg._count, total: inProgressTotal },
        installments: { count: installmentAgg._count, total: installmentTotal },
      },
      allTime: {
        totalServicesCompleted: totalCompleted,
        totalSalesRevenue: salesRevenue,
      },
      inventory: {
        stockCostTotal,
        stockSaleValue,
      },
    });
  } catch (err) {
    logger.error('Dashboard stats error', { error: String(err) });
    res.status(500).json({ error: 'Erro ao carregar estatísticas' });
  }
});

/**
 * GET /dashboard/analytics — Top services and top products analytics.
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;

    // Top 5 services by completed appointments
    const topServicesRaw = await prisma.$queryRaw<Array<{ nome: string; count: bigint }>>`
      SELECT s.nome, COUNT(*)::bigint AS count
      FROM appointments a
      JOIN appointment_services aps ON aps.appointment_id = a.id
      JOIN services s ON s.id = aps.service_id
      WHERE a.tenant_id = ${tenantId}
        AND a.status = 'CONCLUIDO'::"AppointmentStatus"
      GROUP BY s.id, s.nome
      ORDER BY count DESC
      LIMIT 5
    `;

    // Top 5 products by stock movements (SAIDA_USO or SAIDA_VENDA)
    const topProductsRaw = await prisma.$queryRaw<Array<{ nome: string; count: bigint }>>`
      SELECT ii.nome, COUNT(*)::bigint AS count
      FROM stock_movements sm
      JOIN inventory_items ii ON sm.item_id = ii.id
      WHERE sm.tenant_id = ${tenantId}
        AND sm.tipo IN ('SAIDA_USO'::"MovementType", 'SAIDA_VENDA'::"MovementType")
      GROUP BY ii.id, ii.nome
      ORDER BY count DESC
      LIMIT 5
    `;

    res.json({
      topServices: topServicesRaw.map(r => ({ nome: r.nome, count: Number(r.count) })),
      topProducts: topProductsRaw.map(r => ({ nome: r.nome, count: Number(r.count) })),
    });
  } catch (err) {
    logger.error('Dashboard analytics error', { error: String(err) });
    res.status(500).json({ error: 'Erro ao carregar analytics' });
  }
});

/**
 * GET /dashboard/marketplace-metrics — Single call for all marketplace KPIs (<500ms target).
 */
router.get('/marketplace-metrics', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const metrics = await MetricsService.getMarketplaceMetrics(tenantId);
    res.status(200).json(metrics);
  } catch (err) {
    logger.error('Marketplace metrics error', { error: String(err) });
    res.status(500).json({ error: 'Erro ao carregar métricas do marketplace' });
  }
});

export default router;
