import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index';
import { prisma } from '../test/setup';
import { generateTestJwt, authHeader } from '../test/helpers';
import { createUser, createFullTenantSetup } from '../test/factories';
import { slugify } from '../lib/slug';
import { Role } from '../generated/prisma/enums';

const VALID_COMPANY = {
  nome: 'Auto Center Silva',
  descricao: 'Serviços automotivos',
  endereco: {
    rua: 'Rua das Flores',
    numero: '123',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01001-000',
  },
};

const VALID_LOCATION = {
  rua: 'Av. Paulista',
  numero: '1000',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  estado: 'SP',
  cep: '01310-100',
};

// ==================== generateSlug ====================

describe('slugify', () => {
  it('should convert to lowercase', () => {
    expect(slugify('Auto Center')).toBe('auto-center');
  });

  it('should replace spaces with hyphens', () => {
    expect(slugify('my company name')).toBe('my-company-name');
  });

  it('should remove accents/diacritics', () => {
    expect(slugify('Ação Rápida Café')).toBe('acao-rapida-cafe');
  });

  it('should remove special characters', () => {
    expect(slugify('Company @#$% Name!')).toBe('company-name');
  });

  it('should collapse consecutive hyphens', () => {
    expect(slugify('a   b---c')).toBe('a-b-c');
  });

  it('should trim leading/trailing hyphens', () => {
    expect(slugify('  hello world  ')).toBe('hello-world');
  });

  it('should handle complex Brazilian names', () => {
    expect(slugify('São João da Boa Vista')).toBe('sao-joao-da-boa-vista');
  });
});

// ==================== POST /companies ====================

describe('POST /companies', () => {
  it('should create company, tenant, primary location and return new JWT', async () => {
    const user = await createUser({ tenantId: null });
    const token = generateTestJwt({ user_id: user.id, tenant_id: null, role: Role.OWNER });

    const res = await request(app)
      .post('/companies')
      .set('Authorization', authHeader(token))
      .send(VALID_COMPANY);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.company).toBeDefined();
    expect(res.body.company.nome).toBe(VALID_COMPANY.nome);
    expect(res.body.location).toBeDefined();
    expect(res.body.location.is_primary).toBe(true);
    expect(res.body.location.endereco_rua).toBe(VALID_COMPANY.endereco.rua);

    // Verify new JWT contains tenant_id
    const payload = jwt.decode(res.body.token) as Record<string, unknown>;
    expect(payload.tenant_id).toBeDefined();
    expect(payload.tenant_id).not.toBeNull();
    expect(payload.user_id).toBe(user.id);

    // Verify user.tenant_id was updated in DB
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser!.tenant_id).toBe(payload.tenant_id);

    // Verify tenant slug was created
    const tenant = await prisma.tenant.findUnique({ where: { id: payload.tenant_id as string } });
    expect(tenant).not.toBeNull();
    expect(tenant!.slug).toBe('auto-center-silva');
  });

  it('should return 409 if user already has a company', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/companies')
      .set('Authorization', authHeader(token))
      .send(VALID_COMPANY);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Usuário já possui uma empresa configurada');
  });

  it('should return 400 for invalid data', async () => {
    const user = await createUser({ tenantId: null });
    const token = generateTestJwt({ user_id: user.id, tenant_id: null, role: Role.OWNER });

    const res = await request(app)
      .post('/companies')
      .set('Authorization', authHeader(token))
      .send({ nome: '' });

    expect(res.status).toBe(400);
  });
});

// ==================== GET /companies/me ====================

describe('GET /companies/me', () => {
  it('should return the current user company with locations', async () => {
    const { user, company } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .get('/companies/me')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(company.id);
    expect(res.body.nome).toBe(company.nome);
    expect(res.body.locations).toBeDefined();
    expect(res.body.locations.length).toBeGreaterThanOrEqual(1);
  });

  it('should return 403 if user has no tenant', async () => {
    const user = await createUser({ tenantId: null });
    const token = generateTestJwt({ user_id: user.id, tenant_id: null, role: Role.OWNER });

    const res = await request(app)
      .get('/companies/me')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(403);
  });
});

// ==================== PUT /companies/:companyId ====================

describe('PUT /companies/:companyId', () => {
  it('should update company name and description', async () => {
    const { user, company } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .put(`/companies/${company.id}`)
      .set('Authorization', authHeader(token))
      .send({ nome: 'Novo Nome', descricao: 'Nova descrição' });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Novo Nome');
    expect(res.body.descricao).toBe('Nova descrição');
    // tenant_id should remain the same
    expect(res.body.tenant_id).toBe(user.tenant_id);
  });

  it('should return 404 for company from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .put(`/companies/${setup2.company.id}`)
      .set('Authorization', authHeader(token))
      .send({ nome: 'Hacked' });

    expect(res.status).toBe(404);
  });
});

// ==================== LOCATION CRUD ====================

describe('POST /companies/:companyId/locations', () => {
  it('should create a new non-primary location', async () => {
    const { user, company } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post(`/companies/${company.id}/locations`)
      .set('Authorization', authHeader(token))
      .send(VALID_LOCATION);

    expect(res.status).toBe(201);
    expect(res.body.endereco_rua).toBe(VALID_LOCATION.rua);
    expect(res.body.is_primary).toBe(false);
    expect(res.body.tenant_id).toBe(user.tenant_id);
  });

  it('should return 404 for company from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post(`/companies/${setup2.company.id}/locations`)
      .set('Authorization', authHeader(token))
      .send(VALID_LOCATION);

    expect(res.status).toBe(404);
  });
});

describe('GET /companies/:companyId/locations', () => {
  it('should list locations for the company', async () => {
    const { user, company } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    // Add a second location
    await request(app)
      .post(`/companies/${company.id}/locations`)
      .set('Authorization', authHeader(token))
      .send(VALID_LOCATION);

    const res = await request(app)
      .get(`/companies/${company.id}/locations`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});

describe('PUT /companies/locations/:locationId', () => {
  it('should update a location address', async () => {
    const { user, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .put(`/companies/locations/${location.id}`)
      .set('Authorization', authHeader(token))
      .send({ rua: 'Rua Nova', numero: '999' });

    expect(res.status).toBe(200);
    expect(res.body.endereco_rua).toBe('Rua Nova');
    expect(res.body.endereco_numero).toBe('999');
  });

  it('should return 404 for location from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .put(`/companies/locations/${setup2.location.id}`)
      .set('Authorization', authHeader(token))
      .send({ rua: 'Hacked' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /companies/locations/:locationId', () => {
  it('should delete a non-primary location', async () => {
    const { user, company, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    // Create a secondary location
    const createRes = await request(app)
      .post(`/companies/${company.id}/locations`)
      .set('Authorization', authHeader(token))
      .send(VALID_LOCATION);

    const secondaryId = createRes.body.id;

    const res = await request(app)
      .delete(`/companies/locations/${secondaryId}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(204);

    // Verify it's gone
    const deleted = await prisma.location.findUnique({ where: { id: secondaryId } });
    expect(deleted).toBeNull();
  });

  it('should return 400 when trying to delete primary location', async () => {
    const { user, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .delete(`/companies/locations/${location.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Não é possível excluir a localização primária');
  });
});
