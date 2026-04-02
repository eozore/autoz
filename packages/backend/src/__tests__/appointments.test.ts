import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { generateTestJwt, authHeader } from '../test/helpers';
import {
  createFullTenantSetup,
  createService,
  createAppointment,
  createClient,
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
