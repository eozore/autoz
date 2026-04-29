import { describe, it, expect } from 'vitest';
import { prisma } from '../test/setup';
import {
  createFullTenantSetup,
  createService,
  createAppointment,
} from '../test/factories';
import { migrateNotesServices } from '../../scripts/migrate-notes-services';

describe('migrateNotesServices', () => {
  it('should migrate notes containing 1 service name', async () => {
    const { tenant, location } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id, nome: 'Troca de Óleo' });

    const appointment = await createAppointment({
      tenantId: tenant.id,
      locationId: location.id,
    });
    // Set notas directly since factory doesn't support it
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { notas: 'Troca de Óleo' },
    });

    const stats = await migrateNotesServices(prisma as any);

    // Verify AppointmentService was created
    const appointmentServices = await prisma.appointmentService.findMany({
      where: { appointment_id: appointment.id },
    });
    expect(appointmentServices).toHaveLength(1);
    expect(appointmentServices[0].service_id).toBe(service.id);

    // Verify notes were cleaned
    const updated = await prisma.appointment.findUnique({ where: { id: appointment.id } });
    expect(updated!.notas).toBeNull();

    // Verify stats
    expect(stats.matchesFound).toBe(1);
    expect(stats.recordsCreated).toBe(1);
  });

  it('should migrate notes containing multiple service names', async () => {
    const { tenant, location } = await createFullTenantSetup();
    const svc1 = await createService({ tenantId: tenant.id, nome: 'Troca de Óleo' });
    const svc2 = await createService({ tenantId: tenant.id, nome: 'Alinhamento' });
    const svc3 = await createService({ tenantId: tenant.id, nome: 'Balanceamento' });

    const appointment = await createAppointment({
      tenantId: tenant.id,
      locationId: location.id,
    });
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { notas: 'Troca de Óleo, Alinhamento, Balanceamento' },
    });

    const stats = await migrateNotesServices(prisma as any);

    const appointmentServices = await prisma.appointmentService.findMany({
      where: { appointment_id: appointment.id },
    });
    expect(appointmentServices).toHaveLength(3);

    const serviceIds = appointmentServices.map((as) => as.service_id);
    expect(serviceIds).toContain(svc1.id);
    expect(serviceIds).toContain(svc2.id);
    expect(serviceIds).toContain(svc3.id);

    // Notes should be cleaned up
    const updated = await prisma.appointment.findUnique({ where: { id: appointment.id } });
    expect(updated!.notas).toBeNull();

    expect(stats.matchesFound).toBe(3);
    expect(stats.recordsCreated).toBe(3);
  });

  it('should leave notes unchanged when no service names match', async () => {
    const { tenant, location } = await createFullTenantSetup();
    await createService({ tenantId: tenant.id, nome: 'Troca de Óleo' });

    const appointment = await createAppointment({
      tenantId: tenant.id,
      locationId: location.id,
    });
    const originalNotes = 'Cliente pediu para verificar barulho no motor';
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { notas: originalNotes },
    });

    const stats = await migrateNotesServices(prisma as any);

    const updated = await prisma.appointment.findUnique({ where: { id: appointment.id } });
    expect(updated!.notas).toBe(originalNotes);

    const appointmentServices = await prisma.appointmentService.findMany({
      where: { appointment_id: appointment.id },
    });
    expect(appointmentServices).toHaveLength(0);

    expect(stats.matchesFound).toBe(0);
    expect(stats.recordsCreated).toBe(0);
  });

  it('should match service names case-insensitively', async () => {
    const { tenant, location } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id, nome: 'Troca de Óleo' });

    const appointment = await createAppointment({
      tenantId: tenant.id,
      locationId: location.id,
    });
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { notas: 'TROCA DE ÓLEO' },
    });

    await migrateNotesServices(prisma as any);

    const appointmentServices = await prisma.appointmentService.findMany({
      where: { appointment_id: appointment.id },
    });
    expect(appointmentServices).toHaveLength(1);
    expect(appointmentServices[0].service_id).toBe(service.id);

    const updated = await prisma.appointment.findUnique({ where: { id: appointment.id } });
    expect(updated!.notas).toBeNull();
  });

  it('should be idempotent — running twice produces same result', async () => {
    const { tenant, location } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id, nome: 'Alinhamento' });

    const appointment = await createAppointment({
      tenantId: tenant.id,
      locationId: location.id,
    });
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { notas: 'Alinhamento, observação extra' },
    });

    // First run
    const stats1 = await migrateNotesServices(prisma as any);
    expect(stats1.recordsCreated).toBe(1);
    expect(stats1.matchesFound).toBe(1);

    const servicesAfterFirst = await prisma.appointmentService.findMany({
      where: { appointment_id: appointment.id },
    });
    expect(servicesAfterFirst).toHaveLength(1);

    const notesAfterFirst = await prisma.appointment.findUnique({ where: { id: appointment.id } });

    // Second run — should not create duplicates
    const stats2 = await migrateNotesServices(prisma as any);

    const servicesAfterSecond = await prisma.appointmentService.findMany({
      where: { appointment_id: appointment.id },
    });
    expect(servicesAfterSecond).toHaveLength(1);

    const notesAfterSecond = await prisma.appointment.findUnique({ where: { id: appointment.id } });
    expect(notesAfterSecond!.notas).toBe(notesAfterFirst!.notas);

    // Second run should skip the already-existing record
    expect(stats2.recordsCreated).toBe(0);
  });

  it('should migrate legacy service_id to AppointmentService', async () => {
    const { tenant, location } = await createFullTenantSetup();
    const service = await createService({ tenantId: tenant.id, nome: 'Revisão' });

    const appointment = await createAppointment({
      tenantId: tenant.id,
      serviceId: service.id,
      locationId: location.id,
    });
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { notas: 'Observação qualquer' },
    });

    const stats = await migrateNotesServices(prisma as any);

    const appointmentServices = await prisma.appointmentService.findMany({
      where: { appointment_id: appointment.id },
    });
    expect(appointmentServices).toHaveLength(1);
    expect(appointmentServices[0].service_id).toBe(service.id);

    expect(stats.recordsCreated).toBe(1);
  });

  it('should return correct statistics', async () => {
    const { tenant, location } = await createFullTenantSetup();
    const svc1 = await createService({ tenantId: tenant.id, nome: 'Troca de Óleo' });
    const svc2 = await createService({ tenantId: tenant.id, nome: 'Alinhamento' });

    // Appointment 1: has legacy service_id + notes with another service
    const appt1 = await createAppointment({
      tenantId: tenant.id,
      serviceId: svc1.id,
      locationId: location.id,
    });
    await prisma.appointment.update({
      where: { id: appt1.id },
      data: { notas: 'Alinhamento' },
    });

    // Appointment 2: no legacy service_id, notes with one service
    const appt2 = await createAppointment({
      tenantId: tenant.id,
      locationId: location.id,
      dataHora: new Date('2025-07-01T10:00:00.000Z'),
    });
    await prisma.appointment.update({
      where: { id: appt2.id },
      data: { notas: 'Troca de Óleo' },
    });

    // Appointment 3: no notes (should be skipped)
    await createAppointment({
      tenantId: tenant.id,
      locationId: location.id,
      dataHora: new Date('2025-07-02T10:00:00.000Z'),
    });

    const stats = await migrateNotesServices(prisma as any);

    expect(stats.tenantsProcessed).toBe(1);
    expect(stats.appointmentsProcessed).toBe(2);
    // appt1: legacy service_id created (1) + "Alinhamento" match (1) = 2 matches/creates
    // appt2: "Troca de Óleo" match (1) = 1 match/create
    expect(stats.matchesFound).toBe(2);
    expect(stats.recordsCreated).toBe(3); // 1 legacy + 2 from notes
    expect(stats.recordsSkipped).toBe(0);
  });
});
