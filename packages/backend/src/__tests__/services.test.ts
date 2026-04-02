import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { generateTestJwt, authHeader } from '../test/helpers';
import { createFullTenantSetup, createService } from '../test/factories';
import { Role } from '../generated/prisma/enums';

const VALID_SERVICE = {
  nome: 'Troca de Óleo',
  descricao: 'Troca completa com filtro',
  duracao_minutos: 45,
};

// ==================== POST /services ====================

describe('POST /services', () => {
  it('should create a service with provided data', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/services')
      .set('Authorization', authHeader(token))
      .send(VALID_SERVICE);

    expect(res.status).toBe(201);
    expect(res.body.nome).toBe(VALID_SERVICE.nome);
    expect(res.body.descricao).toBe(VALID_SERVICE.descricao);
    expect(res.body.duracao_minutos).toBe(45);
    expect(res.body.ativo).toBe(true);
    expect(res.body.tenant_id).toBe(user.tenant_id);
  });

  it('should default duracao_minutos to 60 when not provided', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/services')
      .set('Authorization', authHeader(token))
      .send({ nome: 'Lavagem Simples' });

    expect(res.status).toBe(201);
    expect(res.body.duracao_minutos).toBe(60);
    expect(res.body.ativo).toBe(true);
  });

  it('should return 400 for missing nome', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/services')
      .set('Authorization', authHeader(token))
      .send({ descricao: 'sem nome' });

    expect(res.status).toBe(400);
  });
});

// ==================== GET /services ====================

describe('GET /services', () => {
  it('should list services for the tenant', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    await createService({ tenantId: tenant.id, nome: 'Serviço A' });
    await createService({ tenantId: tenant.id, nome: 'Serviço B' });

    const res = await request(app)
      .get('/services')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('should not return services from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });

    await createService({ tenantId: setup1.tenant.id, nome: 'Mine' });
    await createService({ tenantId: setup2.tenant.id, nome: 'Theirs' });

    const res = await request(app)
      .get('/services')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].nome).toBe('Mine');
  });
});

// ==================== PUT /services/:serviceId ====================

describe('PUT /services/:serviceId', () => {
  it('should update a service', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    const res = await request(app)
      .put(`/services/${service.id}`)
      .set('Authorization', authHeader(token))
      .send({ nome: 'Novo Nome', duracao_minutos: 90 });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Novo Nome');
    expect(res.body.duracao_minutos).toBe(90);
  });

  it('should return 404 for service from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .put(`/services/${service.id}`)
      .set('Authorization', authHeader(token))
      .send({ nome: 'Hacked' });

    expect(res.status).toBe(404);
  });
});

// ==================== DELETE /services/:serviceId ====================

describe('DELETE /services/:serviceId', () => {
  it('should delete a service', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    const res = await request(app)
      .delete(`/services/${service.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(204);
  });

  it('should return 404 for service from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .delete(`/services/${service.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
  });
});
