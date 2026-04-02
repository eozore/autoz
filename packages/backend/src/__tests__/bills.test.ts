import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { generateTestJwt, authHeader } from '../test/helpers';
import { createFullTenantSetup, createBill } from '../test/factories';
import { Role, BillStatus } from '../generated/prisma/enums';

const VALID_BILL = {
  descricao: 'Conta de luz',
  valor: 150.0,
  data_vencimento: '2025-12-31',
};

// ==================== POST /bills ====================

describe('POST /bills', () => {
  it('should create a bill with status PENDENTE', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/bills')
      .set('Authorization', authHeader(token))
      .send(VALID_BILL);

    expect(res.status).toBe(201);
    expect(res.body.descricao).toBe(VALID_BILL.descricao);
    expect(res.body.status).toBe('PENDENTE');
    expect(res.body.data_pagamento).toBeNull();
  });

  it('should return 400 for invalid data', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/bills')
      .set('Authorization', authHeader(token))
      .send({ descricao: '' });

    expect(res.status).toBe(400);
  });
});

// ==================== GET /bills ====================

describe('GET /bills', () => {
  it('should list bills with pagination', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    for (let i = 0; i < 3; i++) {
      await createBill({ tenantId: tenant.id, descricao: `Bill ${i}` });
    }

    const res = await request(app)
      .get('/bills?limit=2')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.nextCursor).toBeTruthy();
  });

  it('should filter by status', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    await createBill({ tenantId: tenant.id, status: BillStatus.PENDENTE });
    await createBill({ tenantId: tenant.id, status: BillStatus.PAGO });

    const res = await request(app)
      .get('/bills?status=PENDENTE')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].status).toBe('PENDENTE');
  });

  it('should not return bills from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });

    await createBill({ tenantId: setup1.tenant.id, descricao: 'Mine' });
    await createBill({ tenantId: setup2.tenant.id, descricao: 'Theirs' });

    const res = await request(app)
      .get('/bills')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].descricao).toBe('Mine');
  });
});


// ==================== PUT /bills/:billId ====================

describe('PUT /bills/:billId', () => {
  it('should update a bill', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const bill = await createBill({ tenantId: tenant.id });

    const res = await request(app)
      .put(`/bills/${bill.id}`)
      .set('Authorization', authHeader(token))
      .send({ descricao: 'Conta atualizada' });

    expect(res.status).toBe(200);
    expect(res.body.descricao).toBe('Conta atualizada');
  });

  it('should return 404 for bill from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const bill = await createBill({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .put(`/bills/${bill.id}`)
      .set('Authorization', authHeader(token))
      .send({ descricao: 'Hacked' });

    expect(res.status).toBe(404);
  });
});

// ==================== PATCH /bills/:billId/pay ====================

describe('PATCH /bills/:billId/pay', () => {
  it('should mark a bill as paid', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const bill = await createBill({ tenantId: tenant.id });

    const res = await request(app)
      .patch(`/bills/${bill.id}/pay`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAGO');
    expect(res.body.data_pagamento).toBeTruthy();
  });

  it('should return 404 for bill from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const bill = await createBill({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .patch(`/bills/${bill.id}/pay`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
  });
});

// ==================== DELETE /bills/:billId ====================

describe('DELETE /bills/:billId', () => {
  it('should delete a bill', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const bill = await createBill({ tenantId: tenant.id });

    const res = await request(app)
      .delete(`/bills/${bill.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(204);
  });

  it('should return 404 for bill from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const bill = await createBill({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .delete(`/bills/${bill.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
  });
});
