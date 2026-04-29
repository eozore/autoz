import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { generateTestJwt, authHeader } from '../test/helpers';
import {
  createFullTenantSetup,
  createClient,
  createVehicle,
  createVehicleOwnershipHistory,
} from '../test/factories';
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


// ==================== GET /vehicles — Top-level with pagination (Task 10.4) ====================

describe('GET /vehicles — top-level', () => {
  it('should list vehicles with cursor pagination', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'PAG0001' });
    await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'PAG0002' });
    await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'PAG0003' });

    // First page
    const res1 = await request(app)
      .get('/vehicles?limit=2')
      .set('Authorization', authHeader(token));

    expect(res1.status).toBe(200);
    expect(res1.body.data.length).toBe(2);
    expect(res1.body.nextCursor).toBeTruthy();

    // Second page
    const res2 = await request(app)
      .get(`/vehicles?limit=2&cursor=${res1.body.nextCursor}`)
      .set('Authorization', authHeader(token));

    expect(res2.status).toBe(200);
    expect(res2.body.data.length).toBe(1);
    expect(res2.body.nextCursor).toBeNull();
  });

  it('should search by placa', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'XYZ9999' });
    await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'ABC1111' });

    const res = await request(app)
      .get('/vehicles?search=XYZ')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].placa).toBe('XYZ9999');
  });

  it('should search by marca', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    await createVehicle({ tenantId: tenant.id, clientId: client.id, marca: 'Honda', placa: 'HON0001' });
    await createVehicle({ tenantId: tenant.id, clientId: client.id, marca: 'Toyota', placa: 'TOY0001' });

    const res = await request(app)
      .get('/vehicles?search=honda')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].marca).toBe('Honda');
  });

  it('should search by modelo', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    await createVehicle({ tenantId: tenant.id, clientId: client.id, modelo: 'Civic', placa: 'CIV0001' });
    await createVehicle({ tenantId: tenant.id, clientId: client.id, modelo: 'Corolla', placa: 'COR0001' });

    const res = await request(app)
      .get('/vehicles?search=civic')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].modelo).toBe('Civic');
  });

  it('should include client data in response', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id, nome: 'João Silva' });

    await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'CLI0001' });

    const res = await request(app)
      .get('/vehicles')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].client).toBeDefined();
    expect(res.body.data[0].client.nome).toBe('João Silva');
  });
});

// ==================== GET /vehicles/:vehicleId — Detail with history (Task 10.4) ====================

describe('GET /vehicles/:vehicleId — detail', () => {
  it('should return vehicle with client data and ownership history', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client1 = await createClient({ tenantId: tenant.id, nome: 'Owner 1' });
    const client2 = await createClient({ tenantId: tenant.id, nome: 'Owner 2' });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client2.id, placa: 'DET0001' });

    // Create ownership history
    await createVehicleOwnershipHistory(vehicle.id, client1.id, new Date('2024-01-01'), new Date('2024-06-01'));
    await createVehicleOwnershipHistory(vehicle.id, client2.id, new Date('2024-06-01'), null);

    const res = await request(app)
      .get(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(vehicle.id);
    expect(res.body.client).toBeDefined();
    expect(res.body.client.nome).toBe('Owner 2');
    expect(res.body.ownershipHistory).toBeDefined();
    expect(res.body.ownershipHistory.length).toBe(2);
    // Ordered by started_at desc, so current owner first
    expect(res.body.ownershipHistory[0].client.nome).toBe('Owner 2');
    expect(res.body.ownershipHistory[1].client.nome).toBe('Owner 1');
  });

  it('should return 404 for vehicle from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: setup2.tenant.id });
    const vehicle = await createVehicle({ tenantId: setup2.tenant.id, clientId: client.id });

    const res = await request(app)
      .get(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
  });
});

// ==================== POST /vehicles — Top-level creation (Task 10.4) ====================

describe('POST /vehicles — top-level', () => {
  it('should create vehicle with valid client_id', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', authHeader(token))
      .send({
        client_id: client.id,
        marca: 'Fiat',
        modelo: 'Uno',
        ano: 2020,
        placa: 'TOP0001',
      });

    expect(res.status).toBe(201);
    expect(res.body.client_id).toBe(client.id);
    expect(res.body.marca).toBe('Fiat');
    expect(res.body.placa).toBe('TOP0001');
  });

  it('should return 404 for client_id from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const client2 = await createClient({ tenantId: setup2.tenant.id });

    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', authHeader(token))
      .send({
        client_id: client2.id,
        marca: 'Fiat',
        modelo: 'Uno',
        ano: 2020,
        placa: 'TOP0002',
      });

    expect(res.status).toBe(404);
  });

  it('should return 400 when client_id is missing', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', authHeader(token))
      .send({
        marca: 'Fiat',
        modelo: 'Uno',
        ano: 2020,
        placa: 'TOP0003',
      });

    expect(res.status).toBe(400);
  });
});

// ==================== Existing nested endpoints still work (Task 10.4) ====================

describe('Existing nested vehicle endpoints still work', () => {
  it('POST /clients/:clientId/vehicles still creates vehicle', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    const res = await request(app)
      .post(`/clients/${client.id}/vehicles`)
      .set('Authorization', authHeader(token))
      .send({ ...VALID_VEHICLE, placa: 'NEST001' });

    expect(res.status).toBe(201);
    expect(res.body.client_id).toBe(client.id);
  });

  it('GET /clients/:clientId/vehicles still lists vehicles', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });
    await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'NEST002' });

    const res = await request(app)
      .get(`/clients/${client.id}/vehicles`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

// ==================== Vehicle quilometragem and cor fields (Task 10.7) ====================

describe('Vehicle quilometragem and cor fields', () => {
  it('should create vehicle with quilometragem and cor', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });

    const res = await request(app)
      .post(`/clients/${client.id}/vehicles`)
      .set('Authorization', authHeader(token))
      .send({
        ...VALID_VEHICLE,
        placa: 'QC00001',
        quilometragem: 35000,
        cor: 'Vermelho',
      });

    expect(res.status).toBe(201);
    expect(res.body.quilometragem).toBe(35000);
    expect(res.body.cor).toBe('Vermelho');
  });

  it('should update quilometragem with valid value', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id, quilometragem: 10000 });

    const res = await request(app)
      .put(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token))
      .send({ quilometragem: 20000 });

    expect(res.status).toBe(200);
    expect(res.body.quilometragem).toBe(20000);
  });

  it('should reject negative quilometragem', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id });

    const res = await request(app)
      .put(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token))
      .send({ quilometragem: -100 });

    expect(res.status).toBe(400);
  });

  it('should update cor with valid string', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id });

    const res = await request(app)
      .put(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token))
      .send({ cor: 'Preto' });

    expect(res.status).toBe(200);
    expect(res.body.cor).toBe('Preto');
  });

  it('should reject empty string for cor', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id });

    const res = await request(app)
      .put(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token))
      .send({ cor: '' });

    expect(res.status).toBe(400);
  });

  it('should accept null for cor', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id, cor: 'Azul' });

    const res = await request(app)
      .put(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token))
      .send({ cor: null });

    expect(res.status).toBe(200);
    expect(res.body.cor).toBeNull();
  });

  it('should include quilometragem and cor in GET /vehicles response', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });
    await createVehicle({ tenantId: tenant.id, clientId: client.id, quilometragem: 42000, cor: 'Branco', placa: 'QC00002' });

    const res = await request(app)
      .get('/vehicles')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].quilometragem).toBe(42000);
    expect(res.body.data[0].cor).toBe('Branco');
  });
});
