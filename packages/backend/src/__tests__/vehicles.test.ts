import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { generateTestJwt, authHeader } from '../test/helpers';
import { createFullTenantSetup, createClient, createVehicle } from '../test/factories';
import { Role } from '../generated/prisma/enums';

const VALID_VEHICLE = {
  marca: 'Toyota',
  modelo: 'Corolla',
  ano: 2022,
  placa: 'ABC1D23',
};

// ==================== POST /clients/:clientId/vehicles ====================

describe('POST /clients/:clientId/vehicles', () => {
  it('should create a vehicle linked to a client', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    const res = await request(app)
      .post(`/clients/${client.id}/vehicles`)
      .set('Authorization', authHeader(token))
      .send(VALID_VEHICLE);

    expect(res.status).toBe(201);
    expect(res.body.marca).toBe(VALID_VEHICLE.marca);
    expect(res.body.placa).toBe(VALID_VEHICLE.placa);
    expect(res.body.client_id).toBe(client.id);
    expect(res.body.tenant_id).toBe(tenant.id);
  });

  it('should return 409 for duplicate placa within same tenant', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'DUP1234' });

    const res = await request(app)
      .post(`/clients/${client.id}/vehicles`)
      .set('Authorization', authHeader(token))
      .send({ ...VALID_VEHICLE, placa: 'DUP1234' });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Placa');
  });

  it('should allow same placa in different tenants', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();

    const client1 = await createClient({ tenantId: setup1.tenant.id });
    await createVehicle({ tenantId: setup1.tenant.id, clientId: client1.id, placa: 'SAME123' });

    const client2 = await createClient({ tenantId: setup2.tenant.id });
    const token2 = generateTestJwt({ user_id: setup2.user.id, tenant_id: setup2.user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post(`/clients/${client2.id}/vehicles`)
      .set('Authorization', authHeader(token2))
      .send({ ...VALID_VEHICLE, placa: 'SAME123' });

    expect(res.status).toBe(201);
  });

  it('should reject year below 1900', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    const res = await request(app)
      .post(`/clients/${client.id}/vehicles`)
      .set('Authorization', authHeader(token))
      .send({ ...VALID_VEHICLE, ano: 1899, placa: 'OLD0001' });

    expect(res.status).toBe(400);
  });

  it('should reject year above current year + 1', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    const futureYear = new Date().getFullYear() + 2;
    const res = await request(app)
      .post(`/clients/${client.id}/vehicles`)
      .set('Authorization', authHeader(token))
      .send({ ...VALID_VEHICLE, ano: futureYear, placa: 'FUT0001' });

    expect(res.status).toBe(400);
  });

  it('should return 404 for client from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .post(`/clients/${client.id}/vehicles`)
      .set('Authorization', authHeader(token))
      .send(VALID_VEHICLE);

    expect(res.status).toBe(404);
  });
});

// ==================== GET /clients/:clientId/vehicles ====================

describe('GET /clients/:clientId/vehicles', () => {
  it('should list vehicles for a client', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'AAA1111' });
    await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'BBB2222' });

    const res = await request(app)
      .get(`/clients/${client.id}/vehicles`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('should return 404 for client from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .get(`/clients/${client.id}/vehicles`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
  });
});

// ==================== PUT /vehicles/:vehicleId ====================

describe('PUT /vehicles/:vehicleId', () => {
  it('should update a vehicle', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id });

    const res = await request(app)
      .put(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token))
      .send({ marca: 'Honda', modelo: 'Civic' });

    expect(res.status).toBe(200);
    expect(res.body.marca).toBe('Honda');
    expect(res.body.modelo).toBe('Civic');
  });

  it('should return 404 for vehicle from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: setup2.tenant.id });
    const vehicle = await createVehicle({ tenantId: setup2.tenant.id, clientId: client.id });

    const res = await request(app)
      .put(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token))
      .send({ marca: 'Hacked' });

    expect(res.status).toBe(404);
  });
});

// ==================== DELETE /vehicles/:vehicleId ====================

describe('DELETE /vehicles/:vehicleId', () => {
  it('should delete a vehicle', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id });

    const res = await request(app)
      .delete(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(204);
  });

  it('should return 404 for vehicle from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: setup2.tenant.id });
    const vehicle = await createVehicle({ tenantId: setup2.tenant.id, clientId: client.id });

    const res = await request(app)
      .delete(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
  });
});
