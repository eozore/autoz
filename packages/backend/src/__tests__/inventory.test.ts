import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { generateTestJwt, authHeader } from '../test/helpers';
import { createFullTenantSetup, createInventoryItem } from '../test/factories';
import { Role, ItemType } from '../generated/prisma/enums';

const VALID_ITEM = {
  nome: 'Óleo 5W30',
  custo: 25.0,
  valor_venda: 0,
  tipo: 'USO',
  quantidade_inicial: 50,
  quantidade_minima: 5,
};

// ==================== POST /inventory ====================

describe('POST /inventory', () => {
  it('should create an inventory item', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/inventory')
      .set('Authorization', authHeader(token))
      .send(VALID_ITEM);

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe(VALID_ITEM.nome);
    expect(res.body.tipo).toBe('USO');
    expect(res.body.quantidade_atual).toBe(50);
    expect(res.body.quantidade_minima).toBe(5);
  });

  it('should create a VENDA item', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/inventory')
      .set('Authorization', authHeader(token))
      .send({ ...VALID_ITEM, tipo: 'VENDA', valor_venda: 45.0 });

    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe('VENDA');
  });

  it('should return 400 for invalid data', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/inventory')
      .set('Authorization', authHeader(token))
      .send({ nome: '' });

    expect(res.status).toBe(400);
  });
});


// ==================== GET /inventory ====================

describe('GET /inventory', () => {
  it('should list items with pagination', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    for (let i = 0; i < 3; i++) {
      await createInventoryItem({ tenantId: tenant.id, nome: `Item ${i}` });
    }

    const res = await request(app)
      .get('/inventory?limit=2')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.nextCursor).toBeTruthy();

    const res2 = await request(app)
      .get(`/inventory?limit=2&cursor=${res.body.nextCursor}`)
      .set('Authorization', authHeader(token));

    expect(res2.status).toBe(200);
    expect(res2.body.data.length).toBe(1);
    expect(res2.body.nextCursor).toBeNull();
  });

  it('should filter by tipo', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    await createInventoryItem({ tenantId: tenant.id, tipo: ItemType.USO });
    await createInventoryItem({ tenantId: tenant.id, tipo: ItemType.VENDA });

    const res = await request(app)
      .get('/inventory?tipo=USO')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].tipo).toBe('USO');
  });

  it('should not return items from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });

    await createInventoryItem({ tenantId: setup1.tenant.id, nome: 'Mine' });
    await createInventoryItem({ tenantId: setup2.tenant.id, nome: 'Theirs' });

    const res = await request(app)
      .get('/inventory')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].nome).toBe('Mine');
  });
});

// ==================== GET /inventory/summary ====================

describe('GET /inventory/summary', () => {
  it('should return stock summary', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    await createInventoryItem({ tenantId: tenant.id, tipo: ItemType.USO, quantidadeAtual: 10, quantidadeMinima: 5 });
    await createInventoryItem({ tenantId: tenant.id, tipo: ItemType.VENDA, quantidadeAtual: 3, quantidadeMinima: 5 });
    await createInventoryItem({ tenantId: tenant.id, tipo: ItemType.VENDA, quantidadeAtual: 20, quantidadeMinima: 2 });

    const res = await request(app)
      .get('/inventory/summary')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.total_items).toBe(3);
    expect(res.body.total_uso).toBe(1);
    expect(res.body.total_venda).toBe(2);
    expect(res.body.low_stock_count).toBe(1); // item with 3 <= 5
  });
});

// ==================== PUT /inventory/:itemId ====================

describe('PUT /inventory/:itemId', () => {
  it('should update an item', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const item = await createInventoryItem({ tenantId: tenant.id });

    const res = await request(app)
      .put(`/inventory/${item.id}`)
      .set('Authorization', authHeader(token))
      .send({ nome: 'Novo Nome' });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Novo Nome');
  });

  it('should return 404 for item from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const item = await createInventoryItem({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .put(`/inventory/${item.id}`)
      .set('Authorization', authHeader(token))
      .send({ nome: 'Hacked' });

    expect(res.status).toBe(404);
  });
});

// ==================== DELETE /inventory/:itemId ====================

describe('DELETE /inventory/:itemId', () => {
  it('should delete an item', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const item = await createInventoryItem({ tenantId: tenant.id });

    const res = await request(app)
      .delete(`/inventory/${item.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(204);
  });

  it('should return 404 for item from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const item = await createInventoryItem({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .delete(`/inventory/${item.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
  });
});

// ==================== POST /inventory/:itemId/movements ====================

describe('POST /inventory/:itemId/movements', () => {
  it('should create an ENTRADA movement and increase stock', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const item = await createInventoryItem({ tenantId: tenant.id, quantidadeAtual: 10 });

    const res = await request(app)
      .post(`/inventory/${item.id}/movements`)
      .set('Authorization', authHeader(token))
      .send({ tipo: 'ENTRADA', quantidade: 5 });

    expect(res.status).toBe(201);
    expect(res.body.item.quantidade_atual).toBe(15);
    expect(res.body.movement.tipo).toBe('ENTRADA');
  });

  it('should create a SAIDA_USO movement for USO item', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const item = await createInventoryItem({ tenantId: tenant.id, tipo: ItemType.USO, quantidadeAtual: 10 });

    const res = await request(app)
      .post(`/inventory/${item.id}/movements`)
      .set('Authorization', authHeader(token))
      .send({ tipo: 'SAIDA_USO', quantidade: 3 });

    expect(res.status).toBe(201);
    expect(res.body.item.quantidade_atual).toBe(7);
  });

  it('should create a SAIDA_VENDA movement for VENDA item', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const item = await createInventoryItem({ tenantId: tenant.id, tipo: ItemType.VENDA, quantidadeAtual: 10 });

    const res = await request(app)
      .post(`/inventory/${item.id}/movements`)
      .set('Authorization', authHeader(token))
      .send({ tipo: 'SAIDA_VENDA', quantidade: 2 });

    expect(res.status).toBe(201);
    expect(res.body.item.quantidade_atual).toBe(8);
  });

  it('should reject SAIDA_VENDA for USO item', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const item = await createInventoryItem({ tenantId: tenant.id, tipo: ItemType.USO, quantidadeAtual: 10 });

    const res = await request(app)
      .post(`/inventory/${item.id}/movements`)
      .set('Authorization', authHeader(token))
      .send({ tipo: 'SAIDA_VENDA', quantidade: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('SAIDA_VENDA');
  });

  it('should reject SAIDA_USO for VENDA item', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const item = await createInventoryItem({ tenantId: tenant.id, tipo: ItemType.VENDA, quantidadeAtual: 10 });

    const res = await request(app)
      .post(`/inventory/${item.id}/movements`)
      .set('Authorization', authHeader(token))
      .send({ tipo: 'SAIDA_USO', quantidade: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('SAIDA_USO');
  });

  it('should return 422 for insufficient stock', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const item = await createInventoryItem({ tenantId: tenant.id, tipo: ItemType.USO, quantidadeAtual: 3 });

    const res = await request(app)
      .post(`/inventory/${item.id}/movements`)
      .set('Authorization', authHeader(token))
      .send({ tipo: 'SAIDA_USO', quantidade: 5 });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Estoque insuficiente');
  });

  it('should return 404 for item from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const item = await createInventoryItem({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .post(`/inventory/${item.id}/movements`)
      .set('Authorization', authHeader(token))
      .send({ tipo: 'ENTRADA', quantidade: 5 });

    expect(res.status).toBe(404);
  });
});
