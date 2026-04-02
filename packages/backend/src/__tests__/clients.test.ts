import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { generateTestJwt, authHeader } from '../test/helpers';
import { createFullTenantSetup, createClient } from '../test/factories';
import { Role } from '../generated/prisma/enums';

const VALID_CLIENT = {
  nome: 'Maria Santos',
  email: 'maria@test.com',
  celular: '+5511988887777',
  data_nascimento: '1990-05-15',
};

// ==================== POST /clients ====================

describe('POST /clients', () => {
  it('should create a client', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/clients')
      .set('Authorization', authHeader(token))
      .send(VALID_CLIENT);

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe(VALID_CLIENT.nome);
    expect(res.body.celular).toBe(VALID_CLIENT.celular);
    expect(res.body.tenant_id).toBe(user.tenant_id);
  });

  it('should return 409 for duplicate celular within same tenant', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    await createClient({ tenantId: tenant.id, celular: '+5511999990000' });

    const res = await request(app)
      .post('/clients')
      .set('Authorization', authHeader(token))
      .send({ nome: 'Outro', celular: '+5511999990000' });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Celular');
  });

  it('should return 409 for duplicate email within same tenant', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    await createClient({ tenantId: tenant.id, email: 'dup@test.com', celular: '+5511999990001' });

    const res = await request(app)
      .post('/clients')
      .set('Authorization', authHeader(token))
      .send({ nome: 'Outro', celular: '+5511999990002', email: 'dup@test.com' });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Email');
  });

  it('should allow same celular in different tenants', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();

    await createClient({ tenantId: setup1.tenant.id, celular: '+5511999990003' });

    const token2 = generateTestJwt({ user_id: setup2.user.id, tenant_id: setup2.user.tenant_id, role: Role.OWNER });
    const res = await request(app)
      .post('/clients')
      .set('Authorization', authHeader(token2))
      .send({ nome: 'Same Phone', celular: '+5511999990003' });

    expect(res.status).toBe(201);
  });

  it('should return 400 for invalid celular format', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/clients')
      .set('Authorization', authHeader(token))
      .send({ nome: 'Test', celular: '11999990000' });

    expect(res.status).toBe(400);
  });
});

// ==================== GET /clients (pagination) ====================

describe('GET /clients', () => {
  it('should return paginated clients', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    for (let i = 0; i < 3; i++) {
      await createClient({ tenantId: tenant.id });
    }

    const res = await request(app)
      .get('/clients?limit=2')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.nextCursor).toBeTruthy();

    // Fetch next page
    const res2 = await request(app)
      .get(`/clients?limit=2&cursor=${res.body.nextCursor}`)
      .set('Authorization', authHeader(token));

    expect(res2.status).toBe(200);
    expect(res2.body.data.length).toBe(1);
    expect(res2.body.nextCursor).toBeNull();
  });

  it('should not return clients from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });

    await createClient({ tenantId: setup1.tenant.id, nome: 'Mine' });
    await createClient({ tenantId: setup2.tenant.id, nome: 'Theirs' });

    const res = await request(app)
      .get('/clients')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].nome).toBe('Mine');
  });
});

// ==================== GET /clients/:clientId ====================

describe('GET /clients/:clientId', () => {
  it('should return a client by ID', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id, nome: 'Found' });

    const res = await request(app)
      .get(`/clients/${client.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Found');
  });

  it('should return 404 for client from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .get(`/clients/${client.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
  });
});

// ==================== PUT /clients/:clientId ====================

describe('PUT /clients/:clientId', () => {
  it('should update a client', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    const res = await request(app)
      .put(`/clients/${client.id}`)
      .set('Authorization', authHeader(token))
      .send({ nome: 'Novo Nome' });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Novo Nome');
  });

  it('should return 404 for client from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .put(`/clients/${client.id}`)
      .set('Authorization', authHeader(token))
      .send({ nome: 'Hacked' });

    expect(res.status).toBe(404);
  });
});

// ==================== DELETE /clients/:clientId ====================

describe('DELETE /clients/:clientId', () => {
  it('should delete a client', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    const res = await request(app)
      .delete(`/clients/${client.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(204);
  });

  it('should return 404 for client from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .delete(`/clients/${client.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
  });
});
