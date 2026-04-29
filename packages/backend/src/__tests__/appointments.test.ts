import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { generateTestJwt, authHeader } from '../test/helpers';
import {
  createFullTenantSetup,
  createService,
  createAppointment,
  createAppointmentService,
  createClient,
  createVehicle,
} from '../test/factories';
import { Role, AppointmentStatus } from '../generated/prisma/enums';

// ==================== POST /appointments ====================

describe('POST /appointments', () => {
  it('should create an appointment with status AGENDADO', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_id: service.id,
        location_id: location.id,
        data_hora: '2025-08-15T10:00:00.000Z',
        duracao_minutos: 60,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('AGENDADO');
    expect(res.body.service_id).toBe(service.id);
    expect(res.body.location_id).toBe(location.id);
  });

  it('should return 409 for time conflict at same location', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    // Create existing appointment 10:00-11:00
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2025-08-15T10:00:00.000Z'),
      duracaoMinutos: 60,
    });

    // Try to create overlapping appointment 10:30-11:30
    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_id: service.id,
        location_id: location.id,
        data_hora: '2025-08-15T10:30:00.000Z',
        duracao_minutos: 60,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('indisponível');
  });

  it('should allow appointment at same time in different location', async () => {
    const { user, tenant, location, company } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    // Import createLocation to make a second location
    const { createLocation } = await import('../test/factories');
    const location2 = await createLocation({ tenantId: tenant.id, companyId: company.id });

    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2025-08-15T10:00:00.000Z'),
      duracaoMinutos: 60,
    });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_id: service.id,
        location_id: location2.id,
        data_hora: '2025-08-15T10:00:00.000Z',
        duracao_minutos: 60,
      });

    expect(res.status).toBe(201);
  });

  it('should allow appointment when existing one is CANCELADO', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2025-08-15T10:00:00.000Z'),
      duracaoMinutos: 60,
      status: AppointmentStatus.CANCELADO,
    });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_id: service.id,
        location_id: location.id,
        data_hora: '2025-08-15T10:00:00.000Z',
        duracao_minutos: 60,
      });

    expect(res.status).toBe(201);
  });

  it('should return 400 for invalid data', async () => {
    const { user } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({ service_id: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });
});

// ==================== GET /appointments ====================

describe('GET /appointments', () => {
  it('should list appointments by period', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2025-08-10T10:00:00.000Z'),
    });
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2025-08-20T10:00:00.000Z'),
    });
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2025-09-01T10:00:00.000Z'),
    });

    const res = await request(app)
      .get('/appointments?start=2025-08-01T00:00:00.000Z&end=2025-08-31T23:59:59.000Z')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('should not return appointments from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const service1 = await createService({ tenantId: setup1.tenant.id });
    const service2 = await createService({ tenantId: setup2.tenant.id });

    await createAppointment({
      tenantId: setup1.tenant.id,
      serviceId: service1.id,
      locationId: setup1.location.id,
    });
    await createAppointment({
      tenantId: setup2.tenant.id,
      serviceId: service2.id,
      locationId: setup2.location.id,
    });

    const res = await request(app)
      .get('/appointments')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

// ==================== PUT /appointments/:appointmentId ====================

describe('PUT /appointments/:appointmentId', () => {
  it('should update an appointment', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });
    const appointment = await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
    });

    const res = await request(app)
      .put(`/appointments/${appointment.id}`)
      .set('Authorization', authHeader(token))
      .send({ notas: 'Updated notes' });

    expect(res.status).toBe(200);
    expect(res.body.notas).toBe('Updated notes');
  });

  it('should return 409 when update causes conflict', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2025-08-15T10:00:00.000Z'),
      duracaoMinutos: 60,
    });

    const appt2 = await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2025-08-15T14:00:00.000Z'),
      duracaoMinutos: 60,
    });

    // Move appt2 to overlap with first
    const res = await request(app)
      .put(`/appointments/${appt2.id}`)
      .set('Authorization', authHeader(token))
      .send({ data_hora: '2025-08-15T10:30:00.000Z' });

    expect(res.status).toBe(409);
  });

  it('should return 404 for appointment from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: setup2.tenant.id });
    const appointment = await createAppointment({
      tenantId: setup2.tenant.id,
      serviceId: service.id,
      locationId: setup2.location.id,
    });

    const res = await request(app)
      .put(`/appointments/${appointment.id}`)
      .set('Authorization', authHeader(token))
      .send({ notas: 'Hacked' });

    expect(res.status).toBe(404);
  });
});

// ==================== PATCH /appointments/:appointmentId/cancel ====================

describe('PATCH /appointments/:appointmentId/cancel', () => {
  it('should cancel an appointment', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });
    const appointment = await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
    });

    const res = await request(app)
      .patch(`/appointments/${appointment.id}/cancel`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELADO');
  });

  it('should return 404 for appointment from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: setup2.tenant.id });
    const appointment = await createAppointment({
      tenantId: setup2.tenant.id,
      serviceId: service.id,
      locationId: setup2.location.id,
    });

    const res = await request(app)
      .patch(`/appointments/${appointment.id}/cancel`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
  });
});


// ==================== GET /appointments — Default date filter (Task 10.1) ====================

describe('GET /appointments — default date filter', () => {
  it('should apply default ±30 day filter when no params provided', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    const now = new Date();

    // Appointment within range: today
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: now,
    });

    // Appointment within range: 15 days from now
    const inRange = new Date(now);
    inRange.setDate(inRange.getDate() + 15);
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: inRange,
    });

    // Appointment outside range: 60 days from now
    const outOfRange = new Date(now);
    outOfRange.setDate(outOfRange.getDate() + 60);
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: outOfRange,
    });

    // Appointment outside range: 60 days ago
    const pastOutOfRange = new Date(now);
    pastOutOfRange.setDate(pastOutOfRange.getDate() - 60);
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: pastOutOfRange,
    });

    const res = await request(app)
      .get('/appointments')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    // Only the 2 within ±30 days should be returned
    expect(res.body.length).toBe(2);
  });

  it('should use explicit start and end when provided', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2026-03-10T10:00:00.000Z'),
    });
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2026-03-20T10:00:00.000Z'),
    });
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2026-04-15T10:00:00.000Z'),
    });

    const res = await request(app)
      .get('/appointments?start=2026-03-01T00:00:00.000Z&end=2026-03-31T23:59:59.000Z')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('should use only start param when end is not provided', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2026-01-01T10:00:00.000Z'),
    });
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date('2026-06-01T10:00:00.000Z'),
    });

    const res = await request(app)
      .get('/appointments?start=2026-05-01T00:00:00.000Z')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    // Only the June appointment should be returned (>= May 1)
    expect(res.body.length).toBe(1);
  });
});

// ==================== POST /appointments — Multiple services (Task 10.3) ====================

describe('POST /appointments — multiple services', () => {
  it('should create appointment with service_ids (1 service)', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_ids: [service.id],
        location_id: location.id,
        data_hora: '2025-09-01T10:00:00.000Z',
        duracao_minutos: 60,
      });

    expect(res.status).toBe(201);
    expect(res.body.appointmentServices).toHaveLength(1);
    expect(res.body.appointmentServices[0].service.id).toBe(service.id);
  });

  it('should create appointment with service_ids (3 services)', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const svc1 = await createService({ tenantId: tenant.id, nome: 'Troca de óleo' });
    const svc2 = await createService({ tenantId: tenant.id, nome: 'Alinhamento' });
    const svc3 = await createService({ tenantId: tenant.id, nome: 'Balanceamento' });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_ids: [svc1.id, svc2.id, svc3.id],
        location_id: location.id,
        data_hora: '2025-09-02T10:00:00.000Z',
        duracao_minutos: 120,
      });

    expect(res.status).toBe(201);
    expect(res.body.appointmentServices).toHaveLength(3);
    const serviceIds = res.body.appointmentServices.map((as: { service: { id: string } }) => as.service.id);
    expect(serviceIds).toContain(svc1.id);
    expect(serviceIds).toContain(svc2.id);
    expect(serviceIds).toContain(svc3.id);
  });

  it('should reject empty service_ids array', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_ids: [],
        location_id: location.id,
        data_hora: '2025-09-03T10:00:00.000Z',
        duracao_minutos: 60,
      });

    expect(res.status).toBe(400);
  });

  it('should still work with legacy service_id', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_id: service.id,
        location_id: location.id,
        data_hora: '2025-09-04T10:00:00.000Z',
        duracao_minutos: 60,
      });

    expect(res.status).toBe(201);
    expect(res.body.service_id).toBe(service.id);
    // Legacy service_id also creates an AppointmentService record
    expect(res.body.appointmentServices).toHaveLength(1);
  });
});

// ==================== PUT /appointments — Multiple services (Task 10.3) ====================

describe('PUT /appointments — service_ids replacement', () => {
  it('should replace existing services with new service_ids', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const svc1 = await createService({ tenantId: tenant.id, nome: 'Service A' });
    const svc2 = await createService({ tenantId: tenant.id, nome: 'Service B' });
    const svc3 = await createService({ tenantId: tenant.id, nome: 'Service C' });

    // Create appointment with svc1
    const createRes = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_ids: [svc1.id],
        location_id: location.id,
        data_hora: '2025-09-05T10:00:00.000Z',
        duracao_minutos: 60,
      });

    expect(createRes.status).toBe(201);
    const appointmentId = createRes.body.id;

    // Update to svc2 + svc3
    const updateRes = await request(app)
      .put(`/appointments/${appointmentId}`)
      .set('Authorization', authHeader(token))
      .send({ service_ids: [svc2.id, svc3.id] });

    expect(updateRes.status).toBe(200);

    // Verify via GET that services were replaced
    const getRes = await request(app)
      .get(`/appointments?start=2025-09-05T00:00:00.000Z&end=2025-09-05T23:59:59.000Z`)
      .set('Authorization', authHeader(token));

    expect(getRes.status).toBe(200);
    const appt = getRes.body.find((a: { id: string }) => a.id === appointmentId);
    expect(appt.appointmentServices).toHaveLength(2);
    const ids = appt.appointmentServices.map((as: { service: { id: string } }) => as.service.id);
    expect(ids).toContain(svc2.id);
    expect(ids).toContain(svc3.id);
    expect(ids).not.toContain(svc1.id);
  });
});

// ==================== GET /appointments — includes appointmentServices (Task 10.3) ====================

describe('GET /appointments — includes appointmentServices', () => {
  it('should include appointmentServices in response', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    const now = new Date();
    const appointment = await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: now,
    });
    await createAppointmentService(appointment.id, service.id);

    const res = await request(app)
      .get('/appointments')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const appt = res.body.find((a: { id: string }) => a.id === appointment.id);
    expect(appt.appointmentServices).toBeDefined();
    expect(appt.appointmentServices.length).toBeGreaterThanOrEqual(1);
    expect(appt.appointmentServices[0].service).toBeDefined();
    expect(appt.appointmentServices[0].service.id).toBe(service.id);
  });
});

// ==================== POST /appointments — Vehicle link (Task 10.6) ====================

describe('POST /appointments — vehicle link and quilometragem', () => {
  it('should create appointment with valid vehicle_id', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_id: service.id,
        location_id: location.id,
        data_hora: '2025-10-01T10:00:00.000Z',
        duracao_minutos: 60,
        vehicle_id: vehicle.id,
        quilometragem: 50000,
      });

    expect(res.status).toBe(201);
    expect(res.body.vehicle_id).toBe(vehicle.id);
    expect(res.body.quilometragem).toBe(50000);
  });

  it('should return 400 for vehicle_id from another tenant', async () => {
    const setup1 = await createFullTenantSetup();
    const setup2 = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: setup1.user.id, tenant_id: setup1.user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: setup1.tenant.id });
    const client2 = await createClient({ tenantId: setup2.tenant.id });
    const vehicle2 = await createVehicle({ tenantId: setup2.tenant.id, clientId: client2.id });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_id: service.id,
        location_id: setup1.location.id,
        data_hora: '2025-10-02T10:00:00.000Z',
        duracao_minutos: 60,
        vehicle_id: vehicle2.id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Veículo');
  });

  it('should return 400 for quilometragem without vehicle_id', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });

    const res = await request(app)
      .post('/appointments')
      .set('Authorization', authHeader(token))
      .send({
        service_id: service.id,
        location_id: location.id,
        data_hora: '2025-10-03T10:00:00.000Z',
        duracao_minutos: 60,
        quilometragem: 50000,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('quilometragem');
  });
});

// ==================== PATCH /appointments/:id/status — quilometragem update (Task 10.6) ====================

describe('PATCH /appointments/:id/status — quilometragem on CONCLUIDO', () => {
  it('should update vehicle quilometragem when appointment value is greater', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id, quilometragem: 40000 });

    const appointment = await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      vehicleId: vehicle.id,
      quilometragem: 55000,
      dataHora: new Date('2025-10-10T10:00:00.000Z'),
    });

    const res = await request(app)
      .patch(`/appointments/${appointment.id}/status`)
      .set('Authorization', authHeader(token))
      .send({ status: 'CONCLUIDO' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONCLUIDO');

    // Verify vehicle quilometragem was updated
    const vehicleRes = await request(app)
      .get(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token));

    expect(vehicleRes.status).toBe(200);
    expect(vehicleRes.body.quilometragem).toBe(55000);
  });

  it('should NOT update vehicle quilometragem when appointment value is less or equal', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id, quilometragem: 60000 });

    const appointment = await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      vehicleId: vehicle.id,
      quilometragem: 55000,
      dataHora: new Date('2025-10-11T10:00:00.000Z'),
    });

    const res = await request(app)
      .patch(`/appointments/${appointment.id}/status`)
      .set('Authorization', authHeader(token))
      .send({ status: 'CONCLUIDO' });

    expect(res.status).toBe(200);

    // Verify vehicle quilometragem was NOT updated
    const vehicleRes = await request(app)
      .get(`/vehicles/${vehicle.id}`)
      .set('Authorization', authHeader(token));

    expect(vehicleRes.status).toBe(200);
    expect(vehicleRes.body.quilometragem).toBe(60000);
  });
});

// ==================== GET /appointments — includes vehicle data (Task 10.6) ====================

describe('GET /appointments — includes vehicle data', () => {
  it('should include vehicle data and quilometragem in response', async () => {
    const { user, tenant, location } = await createFullTenantSetup();
    const token = generateTestJwt({ user_id: user.id, tenant_id: user.tenant_id, role: Role.OWNER });
    const service = await createService({ tenantId: tenant.id });
    const client = await createClient({ tenantId: tenant.id });
    const vehicle = await createVehicle({ tenantId: tenant.id, clientId: client.id, placa: 'VEH1234', cor: 'Azul' });

    const now = new Date();
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      vehicleId: vehicle.id,
      quilometragem: 45000,
      dataHora: now,
    });

    const res = await request(app)
      .get('/appointments')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const appt = res.body[0];
    expect(appt.vehicle).toBeDefined();
    expect(appt.vehicle.id).toBe(vehicle.id);
    expect(appt.vehicle.placa).toBe('VEH1234');
    expect(appt.vehicle.cor).toBe('Azul');
    expect(appt.quilometragem).toBe(45000);
  });
});
