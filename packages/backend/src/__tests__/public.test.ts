import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import {
  createFullTenantSetup,
  createService,
  createAppointment,
} from '../test/factories';
import { AppointmentStatus } from '../generated/prisma/enums';

// ==================== GET /public/:slug/profile ====================

describe('GET /public/:slug/profile', () => {
  it('should return public profile for valid slug', async () => {
    const { tenant, company } = await createFullTenantSetup();

    const res = await request(app).get(`/public/${tenant.slug}/profile`);

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe(company.nome);
    expect(res.body).toHaveProperty('logo_url');
    expect(res.body).toHaveProperty('descricao');
  });

  it('should return 404 for invalid slug', async () => {
    const res = await request(app).get('/public/nonexistent-slug/profile');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('não encontrado');
  });
});

// ==================== GET /public/:slug/services ====================

describe('GET /public/:slug/services', () => {
  it('should return only active services', async () => {
    const { tenant } = await createFullTenantSetup();

    await createService({ tenantId: tenant.id, nome: 'Active Service', ativo: true });
    await createService({ tenantId: tenant.id, nome: 'Inactive Service', ativo: false });

    const res = await request(app).get(`/public/${tenant.slug}/services`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nome).toBe('Active Service');
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('duracao_minutos');
  });

  it('should return 404 for invalid slug', async () => {
    const res = await request(app).get('/public/nonexistent-slug/services');
    expect(res.status).toBe(404);
  });
});

// ==================== GET /public/:slug/whatsapp ====================

describe('GET /public/:slug/whatsapp', () => {
  it('should return correct wa.me link', async () => {
    const { tenant, user } = await createFullTenantSetup();

    const res = await request(app).get(`/public/${tenant.slug}/whatsapp`);

    expect(res.status).toBe(200);
    const expectedNumber = user.celular.replace(/\D/g, '');
    expect(res.body.link).toBe(`https://wa.me/${expectedNumber}`);
  });

  it('should return 404 for invalid slug', async () => {
    const res = await request(app).get('/public/nonexistent-slug/whatsapp');
    expect(res.status).toBe(404);
  });
});

// ==================== GET /public/:slug/slots ====================

describe('GET /public/:slug/slots', () => {
  it('should return available slots for a service on a date', async () => {
    const { tenant } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id, duracaoMinutos: 60 });

    // Use a future date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateStr = futureDate.toISOString().split('T')[0];

    const res = await request(app)
      .get(`/public/${tenant.slug}/slots?service_id=${service.id}&date=${dateStr}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // 08:00-18:00 with 60min slots = 10 slots
    expect(res.body).toHaveLength(10);
    // Verify chronological order
    for (let i = 1; i < res.body.length; i++) {
      expect(new Date(res.body[i]).getTime()).toBeGreaterThan(new Date(res.body[i - 1]).getTime());
    }
  });

  it('should exclude slots with active appointments', async () => {
    const { tenant, location } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id, duracaoMinutos: 60 });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateStr = futureDate.toISOString().split('T')[0];

    // Book the 10:00 slot
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date(`${dateStr}T10:00:00.000Z`),
      duracaoMinutos: 60,
      status: AppointmentStatus.AGENDADO,
    });

    const res = await request(app)
      .get(`/public/${tenant.slug}/slots?service_id=${service.id}&date=${dateStr}`);

    expect(res.status).toBe(200);
    // 10 total - 1 booked = 9
    expect(res.body).toHaveLength(9);
    // The 10:00 slot should not be present
    const has10 = res.body.some((s: string) => s.includes(`${dateStr}T10:00:00`));
    expect(has10).toBe(false);
  });

  it('should not exclude slots for CANCELADO appointments', async () => {
    const { tenant, location } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id, duracaoMinutos: 60 });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateStr = futureDate.toISOString().split('T')[0];

    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: new Date(`${dateStr}T10:00:00.000Z`),
      duracaoMinutos: 60,
      status: AppointmentStatus.CANCELADO,
    });

    const res = await request(app)
      .get(`/public/${tenant.slug}/slots?service_id=${service.id}&date=${dateStr}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
  });

  it('should reject past date', async () => {
    const { tenant } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id });

    const res = await request(app)
      .get(`/public/${tenant.slug}/slots?service_id=${service.id}&date=2020-01-01`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Data');
  });

  it('should reject inactive service', async () => {
    const { tenant } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id, ativo: false });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateStr = futureDate.toISOString().split('T')[0];

    const res = await request(app)
      .get(`/public/${tenant.slug}/slots?service_id=${service.id}&date=${dateStr}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('não disponível');
  });

  it('should return 400 when missing query params', async () => {
    const { tenant } = await createFullTenantSetup();

    const res = await request(app).get(`/public/${tenant.slug}/slots`);
    expect(res.status).toBe(400);
  });
});

// ==================== POST /public/:slug/appointments ====================

describe('POST /public/:slug/appointments', () => {
  it('should create a public appointment successfully', async () => {
    const { tenant } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    futureDate.setHours(10, 0, 0, 0);

    const res = await request(app)
      .post(`/public/${tenant.slug}/appointments`)
      .send({
        nome_visitante: 'João Visitante',
        celular_visitante: '+5511999999999',
        service_id: service.id,
        data_hora: futureDate.toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('AGENDADO');
    expect(res.body.client_id).toBeNull();
    expect(res.body.nome_visitante).toBe('João Visitante');
    expect(res.body.celular_visitante).toBe('+5511999999999');
    expect(res.body.duracao_minutos).toBe(service.duracao_minutos);
  });

  it('should reject appointment with time conflict', async () => {
    const { tenant, location } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id, duracaoMinutos: 60 });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    futureDate.setHours(10, 0, 0, 0);

    // Create existing appointment
    await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
      dataHora: futureDate,
      duracaoMinutos: 60,
    });

    const res = await request(app)
      .post(`/public/${tenant.slug}/appointments`)
      .send({
        nome_visitante: 'Visitor',
        celular_visitante: '+5511888888888',
        service_id: service.id,
        data_hora: futureDate.toISOString(),
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('indisponível');
  });

  it('should reject appointment for inactive service', async () => {
    const { tenant } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id, ativo: false });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    futureDate.setHours(10, 0, 0, 0);

    const res = await request(app)
      .post(`/public/${tenant.slug}/appointments`)
      .send({
        nome_visitante: 'Visitor',
        celular_visitante: '+5511888888888',
        service_id: service.id,
        data_hora: futureDate.toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('não disponível');
  });

  it('should reject appointment with past date', async () => {
    const { tenant } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id });

    const res = await request(app)
      .post(`/public/${tenant.slug}/appointments`)
      .send({
        nome_visitante: 'Visitor',
        celular_visitante: '+5511888888888',
        service_id: service.id,
        data_hora: '2020-01-01T10:00:00.000Z',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('futura');
  });

  it('should require nome_visitante', async () => {
    const { tenant } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const res = await request(app)
      .post(`/public/${tenant.slug}/appointments`)
      .send({
        celular_visitante: '+5511888888888',
        service_id: service.id,
        data_hora: futureDate.toISOString(),
      });

    expect(res.status).toBe(400);
  });

  it('should require celular_visitante', async () => {
    const { tenant } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const res = await request(app)
      .post(`/public/${tenant.slug}/appointments`)
      .send({
        nome_visitante: 'Visitor',
        service_id: service.id,
        data_hora: futureDate.toISOString(),
      });

    expect(res.status).toBe(400);
  });

  it('should return 404 for invalid slug', async () => {
    const res = await request(app)
      .post('/public/nonexistent-slug/appointments')
      .send({
        nome_visitante: 'Visitor',
        celular_visitante: '+5511888888888',
        service_id: '00000000-0000-0000-0000-000000000000',
        data_hora: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(res.status).toBe(404);
  });
});
