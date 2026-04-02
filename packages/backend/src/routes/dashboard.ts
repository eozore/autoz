import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppointmentStatus, BillStatus, MovementType } from '../generated/prisma/enums';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Completed appointments this month (services revenue)
    const servicesAgg = await prisma.appointment.aggregate({
      where: {
        tenant_id: tenantId,
        status: AppointmentStatus.CONCLUIDO,
        data_hora: { gte: monthStart, lte: monthEnd },
      },
      _sum: { valor_servico: true, desconto: true },
      _count: true,
    });

    const servicesRevenue =
      Number(servicesAgg._sum.valor_servico ?? 0) -
      Number(servicesAgg._sum.desconto ?? 0);

    // Sales revenue this month (SAIDA_VENDA movements)
    // Prisma doesn't support aggregate with computed join fields,
    // so we use a raw query for sales revenue
    const salesResult = await prisma.$queryRaw<[{ total: number | null }]>`
      SELECT COALESCE(SUM(ii.valor_venda * sm.quantidade), 0)::float AS total
      FROM stock_movements sm
      JOIN inventory_items ii ON sm.item_id = ii.id
      WHERE sm.tenant_id = ${tenantId}
        AND sm.tipo = ${MovementType.SAIDA_VENDA}::"MovementType"
        AND sm.created_at >= ${monthStart}
        AND sm.created_at <= ${monthEnd}
    `;
    const salesRevenue = Number(salesResult[0]?.total ?? 0);

    // Receivables: EM_ANDAMENTO appointments
    const inProgressAgg = await prisma.appointment.aggregate({
      where: {
        tenant_id: tenantId,
        status: AppointmentStatus.EM_ANDAMENTO,
      },
      _sum: { valor_servico: true, desconto: true },
      _count: true,
    });

    const inProgressTotal =
      Number(inProgressAgg._sum.valor_servico ?? 0) -
      Number(inProgressAgg._sum.desconto ?? 0);

    // Receivables: CONCLUIDO + PARCELADO
    const installmentAgg = await prisma.appointment.aggregate({
      where: {
        tenant_id: tenantId,
        status: AppointmentStatus.CONCLUIDO,
        forma_pagamento: 'PARCELADO',
      },
      _sum: { valor_servico: true, desconto: true },
      _count: true,
    });

    const installmentTotal =
      Number(installmentAgg._sum.valor_servico ?? 0) -
      Number(installmentAgg._sum.desconto ?? 0);

    // Bills summary: groupBy status
    const billsGrouped = await prisma.bill.groupBy({
      by: ['status'],
      where: { tenant_id: tenantId },
      _sum: { valor: true },
      _count: true,
    });

    const paidGroup = billsGrouped.find((g) => g.status === BillStatus.PAGO);
    const pendingGroup = billsGrouped.find((g) => g.status === BillStatus.PENDENTE);

    const totalPaid = Number(paidGroup?._sum.valor ?? 0);
    const totalPending = Number(pendingGroup?._sum.valor ?? 0);

    // Overdue bills: PENDENTE with past due date
    const overdueAgg = await prisma.bill.aggregate({
      where: {
        tenant_id: tenantId,
        status: BillStatus.PENDENTE,
        data_vencimento: { lt: now },
      },
      _sum: { valor: true },
      _count: true,
    });

    const totalOverdue = Number(overdueAgg._sum.valor ?? 0);

    // Monthly bills (due this month)
    const monthlyBillsAgg = await prisma.bill.aggregate({
      where: {
        tenant_id: tenantId,
        data_vencimento: { gte: monthStart, lte: monthEnd },
      },
      _sum: { valor: true },
    });

    const monthlyPaidAgg = await prisma.bill.aggregate({
      where: {
        tenant_id: tenantId,
        data_vencimento: { gte: monthStart, lte: monthEnd },
        status: BillStatus.PAGO,
      },
      _sum: { valor: true },
    });

    const monthlyExpenses = Number(monthlyBillsAgg._sum.valor ?? 0);
    const monthlyPaid = Number(monthlyPaidAgg._sum.valor ?? 0);

    // All-time completed appointments count
    const totalCompleted = await prisma.appointment.count({
      where: { tenant_id: tenantId, status: AppointmentStatus.CONCLUIDO },
    });

    // Inventory: stock cost total (all items) and sale value (VENDA items only)
    const stockCostResult = await prisma.$queryRaw<[{ total: number | null }]>`
      SELECT COALESCE(SUM(custo * quantidade_atual), 0)::float AS total
      FROM inventory_items
      WHERE tenant_id = ${tenantId}
    `;
    const stockCostTotal = Number(stockCostResult[0]?.total ?? 0);

    const stockSaleResult = await prisma.$queryRaw<[{ total: number | null }]>`
      SELECT COALESCE(SUM(valor_venda * quantidade_atual), 0)::float AS total
      FROM inventory_items
      WHERE tenant_id = ${tenantId}
        AND tipo = 'VENDA'::"ItemType"
    `;
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

export default router;
