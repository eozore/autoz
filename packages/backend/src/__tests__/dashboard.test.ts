import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { generateTestJwt, authHeader } from '../test/helpers';
import { prisma } from '../test/setup';
import {
  createFullTenantSetup,
  createService,
  createBill,
  createInventoryItem,
  createStockMovement,
} from '../test/factories';
import {
  Role,
  AppointmentStatus,
  BillStatus,
  ItemType,
  MovementType,
} from '../generated/prisma/enums';

describe('GET /dashboard/stats', () => {
  it('should return correct shape with empty data', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: Role.OWNER,
    });

    const res = await request(app)
      .get('/dashboard/stats')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);

    // Verify top-level keys
    expect(res.body).toHaveProperty('month');
    expect(res.body).toHaveProperty('bills');
    expect(res.body).toHaveProperty('receivables');
    expect(res.body).toHaveProperty('allTime');
    expect(res.body).toHaveProperty('inventory');

    // Verify month shape
    expect(res.body.month).toEqual({
      servicesCompleted: 0,
      salesRevenue: 0,
      servicesRevenue: 0,
      totalExpenses: 0,
      paidExpenses: 0,
      pendingExpenses: 0,
      cashFlow: 0,
    });

    // Verify bills shape
    expect(res.body.bills).toEqual({
      totalPaid: 0,
      totalPending: 0,
      totalOverdue: 0,
      overdueCount: 0,
    });

    // Verify receivables shape
    expect(res.body.receivables).toEqual({
      inProgress: { count: 0, total: 0 },
      installments: { count: 0, total: 0 },
    });

    // Verify allTime shape
    expect(res.body.allTime).toEqual({
      totalServicesCompleted: 0,
      totalSalesRevenue: 0,
    });

    // Verify inventory shape
    expect(res.body.inventory).toEqual({
      stockCostTotal: 0,
      stockSaleValue: 0,
    });
  });

  it('should compute correct values with seeded data', async () => {
    const { tenant, user, location } = await createFullTenantSetup();
    const token = generateTestJwt({
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: Role.OWNER,
    });

    const service = await createService({ tenantId: tenant.id });

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15, 10, 0, 0);

    // Create 2 completed appointments this month with known values
    await prisma.appointment.create({
      data: {
        tenant_id: tenant.id,
        service_id: service.id,
        location_id: location.id,
        data_hora: thisMonth,
        duracao_minutos: 60,
        status: AppointmentStatus.CONCLUIDO,
        valor_servico: 200.0,
        desconto: 20.0,
      },
    });
    await prisma.appointment.create({
      data: {
        tenant_id: tenant.id,
        service_id: service.id,
        location_id: location.id,
        data_hora: thisMonth,
        duracao_minutos: 30,
        status: AppointmentStatus.CONCLUIDO,
        valor_servico: 100.0,
        desconto: 0,
      },
    });

    // 1 in-progress appointment (receivable)
    await prisma.appointment.create({
      data: {
        tenant_id: tenant.id,
        service_id: service.id,
        location_id: location.id,
        data_hora: thisMonth,
        duracao_minutos: 45,
        status: AppointmentStatus.EM_ANDAMENTO,
        valor_servico: 150.0,
        desconto: 10.0,
      },
    });

    // 1 completed + PARCELADO appointment (installment receivable)
    await prisma.appointment.create({
      data: {
        tenant_id: tenant.id,
        service_id: service.id,
        location_id: location.id,
        data_hora: thisMonth,
        duracao_minutos: 60,
        status: AppointmentStatus.CONCLUIDO,
        valor_servico: 300.0,
        desconto: 50.0,
        forma_pagamento: 'PARCELADO',
      },
    });

    // Bills: 1 paid, 1 pending (not overdue), 1 overdue
    await createBill({
      tenantId: tenant.id,
      valor: 500,
      status: BillStatus.PAGO,
      dataVencimento: thisMonth,
    });
    await createBill({
      tenantId: tenant.id,
      valor: 300,
      status: BillStatus.PENDENTE,
      dataVencimento: new Date(now.getFullYear() + 1, 0, 1), // future
    });
    await createBill({
      tenantId: tenant.id,
      valor: 200,
      status: BillStatus.PENDENTE,
      dataVencimento: new Date(2020, 0, 1), // past = overdue
    });

    // Inventory: 1 USO item, 1 VENDA item
    const usoItem = await createInventoryItem({
      tenantId: tenant.id,
      tipo: ItemType.USO,
      custo: 10,
      valorVenda: 20,
      quantidadeAtual: 5,
    });
    const vendaItem = await createInventoryItem({
      tenantId: tenant.id,
      tipo: ItemType.VENDA,
      custo: 15,
      valorVenda: 30,
      quantidadeAtual: 10,
    });

    // Sales movement this month
    await createStockMovement({
      tenantId: tenant.id,
      itemId: vendaItem.id,
      tipo: MovementType.SAIDA_VENDA,
      quantidade: 3,
    });

    const res = await request(app)
      .get('/dashboard/stats')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);

    // servicesRevenue: (200-20) + (100-0) + (300-50) = 530
    // But only CONCLUIDO this month count for servicesRevenue in month section
    // The PARCELADO one is also CONCLUIDO this month, so: (200-20) + (100-0) + (300-50) = 530
    // servicesCompleted: 3 (all CONCLUIDO this month)
    expect(res.body.month.servicesCompleted).toBe(3);
    expect(res.body.month.servicesRevenue).toBeCloseTo(530, 1);

    // salesRevenue: vendaItem.valor_venda(30) * quantity(3) = 90
    expect(res.body.month.salesRevenue).toBeCloseTo(90, 1);

    // Monthly expenses: only the paid bill (500) is due this month
    expect(res.body.month.totalExpenses).toBeCloseTo(500, 1);
    expect(res.body.month.paidExpenses).toBeCloseTo(500, 1);
    expect(res.body.month.pendingExpenses).toBeCloseTo(0, 1);

    // cashFlow: (90 + 530) - 500 = 120
    expect(res.body.month.cashFlow).toBeCloseTo(120, 1);

    // Bills totals
    expect(res.body.bills.totalPaid).toBeCloseTo(500, 1);
    expect(res.body.bills.totalPending).toBeCloseTo(500, 1); // 300 + 200
    expect(res.body.bills.totalOverdue).toBeCloseTo(200, 1);
    expect(res.body.bills.overdueCount).toBe(1);

    // Receivables
    expect(res.body.receivables.inProgress.count).toBe(1);
    expect(res.body.receivables.inProgress.total).toBeCloseTo(140, 1); // 150-10
    expect(res.body.receivables.installments.count).toBe(1);
    expect(res.body.receivables.installments.total).toBeCloseTo(250, 1); // 300-50

    // All-time completed: 3 (the 2 regular + 1 PARCELADO)
    expect(res.body.allTime.totalServicesCompleted).toBe(3);
    // allTime.totalSalesRevenue = same as month salesRevenue
    expect(res.body.allTime.totalSalesRevenue).toBeCloseTo(90, 1);

    // Inventory
    // stockCostTotal: (10*5) + (15*10) = 50 + 150 = 200
    expect(res.body.inventory.stockCostTotal).toBeCloseTo(200, 1);
    // stockSaleValue: only VENDA items: 30*10 = 300
    expect(res.body.inventory.stockSaleValue).toBeCloseTo(300, 1);
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/dashboard/stats');
    expect(res.status).toBe(401);
  });
});
