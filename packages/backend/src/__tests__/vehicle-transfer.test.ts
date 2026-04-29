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

// ==================== PATCH /vehicles/:vehicleId/transfer (Task 10.5) ====================

describe('PATCH /vehicles/:vehicleId/transfer', () => {
  it('should transfer vehicle ownership to another client', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client1 = await createClient({ tenantId: tenant.id, nome: 'Original Owner' });
    const client2 = await createClient({ tenantId: tenant.id, nome: 'New Owner' });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client1.id, placa: 'TRF0001' });

    // Create initial ownership record
    await createVehicleOwnershipHistory(vehicle.id, client1.id, new Date('2024-01-01'), null);

    const res = await request(app)
      .patch(`/vehicles/${vehicle.id}/transfer`)
      .set('Authorization', authHeader(token))
      .send({ client_id: client2.id });

    expect(res.status).toBe(200);
    expect(res.body.client_id).toBe(client2.id);
    expect(res.body.client.nome).toBe('New Owner');
  });

  it('should create correct ownership history records', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client1 = await createClient({ tenantId: tenant.id, nome: 'First Owner' });
    const client2 = await createClient({ tenantId: tenant.id, nome: 'Second Owner' });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client1.id, placa: 'TRF0002' });

    // Create initial ownership record
    await createVehicleOwnershipHistory(vehicle.id, client1.id, new Date('2024-01-01'), null);

    // Transfer
    await request(app)
      .patch(`/vehicles/${vehicle.id}/transfer`)
      .set('Authorization', authHeader(token))
      .send({ client_id: client2.id });

    // Verify history via GET /vehicles/:vehicleId
    const detailRes = await request(app)
      .get(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token));

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.ownershipHistory.length).toBe(2);

    // Most recent first (started_at desc)
    const [current, previous] = detailRes.body.ownershipHistory;
    expect(current.client.nome).toBe('Second Owner');
    expect(current.ended_at).toBeNull();
    expect(previous.client.nome).toBe('First Owner');
    expect(previous.ended_at).not.toBeNull();
  });

  it('should return 400 when transferring to same client', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'TRF0003' });

    const res = await request(app)
      .patch(`/vehicles/${vehicle.id}/transfer`)
      .set('Authorization', authHeader(token))
      .send({ client_id: client.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('já pertence');
  });

  it('should return 404 when transferring to client from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const client1 = await createClient({ tenantId: setup1.tenant.id });
    const client2 = await createClient({ tenantId: setup2.tenant.id });
    const vehicle = await createVehicle({ tenantId: setup1.tenant.id, clientId: client1.id, placa: 'TRF0004' });

    const res = await request(app)
      .patch(`/vehicles/${vehicle.id}/transfer`)
      .set('Authorization', authHeader(token))
      .send({ client_id: client2.id });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Cliente');
  });

  it('should handle multiple sequential transfers with complete history', async () => {
    const { user, tenant } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const clientA = await createClient({ tenantId: tenant.id, nome: 'Client A' });
    const clientB = await createClient({ tenantId: tenant.id, nome: 'Client B' });
    const clientC = await createClient({ tenantId: tenant.id, nome: 'Client C' });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: clientA.id, placa: 'TRF0005' });

    // Create initial ownership record
    await createVehicleOwnershipHistory(vehicle.id, clientA.id, new Date('2024-01-01'), null);

    // Transfer A → B
    const res1 = await request(app)
      .patch(`/vehicles/${vehicle.id}/transfer`)
      .set('Authorization', authHeader(token))
      .send({ client_id: clientB.id });
    expect(res1.status).toBe(200);

    // Transfer B → C
    const res2 = await request(app)
      .patch(`/vehicles/${vehicle.id}/transfer`)
      .set('Authorization', authHeader(token))
      .send({ client_id: clientC.id });
    expect(res2.status).toBe(200);

    // Verify complete history
    const detailRes = await request(app)
      .get(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token));

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.client_id).toBe(clientC.id);
    expect(detailRes.body.ownershipHistory.length).toBe(3);

    // Most recent first (started_at desc)
    const history = detailRes.body.ownershipHistory;
    expect(history[0].client.nome).toBe('Client C');
    expect(history[0].ended_at).toBeNull();
    expect(history[1].client.nome).toBe('Client B');
    expect(history[1].ended_at).not.toBeNull();
    expect(history[2].client.nome).toBe('Client A');
    expect(history[2].ended_at).not.toBeNull();
  });

  it('should return 404 for vehicle from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const client1 = await createClient({ tenantId: setup1.tenant.id });
    const client2 = await createClient({ tenantId: setup2.tenant.id });
    const vehicle = await createVehicle({ tenantId: setup2.tenant.id, clientId: client2.id, placa: 'TRF0006' });

    const res = await request(app)
      .patch(`/vehicles/${vehicle.id}/transfer`)
      .set('Authorization', authHeader(token))
      .send({ client_id: client1.id });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Veículo');
  });
});
