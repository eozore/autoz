import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { createAppointmentSchema, updateAppointmentSchema } from '../schemas/appointment';
import { ZodError } from 'zod';
import { AppointmentStatus, FormaPagamento } from '../generated/prisma/enums';
import { getDefaultDateRange } from '../lib/dateFilter';

const router = Router();

/**
 * Check for time conflicts at the same location.
 * Returns true if there is a conflict.
 */
async function hasTimeConflict(
  tenantId: string,
  locationId: string,
  dataHora: Date,
  duracaoMinutos: number,
  excludeId?: string,
): Promise<boolean> {
  const endTime = new Date(dataHora.getTime() + duracaoMinutos * 60 * 1000);

  const where: Record<string, unknown> = {
    tenant_id: tenantId,
    location_id: locationId,
    status: {
      notIn: [AppointmentStatus.CANCELADO, AppointmentStatus.CONCLUIDO],
    },
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  const conflicts = await prisma.appointment.findMany({
    where,
    select: { data_hora: true, duracao_minutos: true },
  });

  return conflicts.some((appt) => {
    const apptStart = new Date(appt.data_hora).getTime();
    const apptEnd = apptStart + appt.duracao_minutos * 60 * 1000;
    const newStart = dataHora.getTime();
    const newEnd = endTime.getTime();
    return newStart < apptEnd && newEnd > apptStart;
  });
}

/**
 * Validate that a vehicle belongs to the given tenant.
 * Returns the vehicle if valid, or null if not found / wrong tenant.
 */
async function validateVehicleTenant(vehicleId: string, tenantId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.tenant_id !== tenantId) {
    return null;
  }
  return vehicle;
}

/**
 * Validate that all service IDs belong to the given tenant.
 * Returns the invalid service ID if any, or null if all valid.
 */
async function validateServiceIdsTenant(serviceIds: string[], tenantId: string): Promise<string | null> {
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, tenant_id: tenantId },
    select: { id: true },
  });
  const foundIds = new Set(services.map((s) => s.id));
  for (const id of serviceIds) {
    if (!foundIds.has(id)) return id;
  }
  return null;
}

/**
 * POST /appointments — Create a new appointment with conflict check.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createAppointmentSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;
    const dataHora = new Date(data.data_hora);

    // Determine service_id(s)
    const serviceIds = data.service_ids;
    const legacyServiceId = data.service_id;

    if (!serviceIds && !legacyServiceId) {
      res.status(400).json({ error: 'service_id ou service_ids é obrigatório' });
      return;
    }

    // Validate quilometragem requires vehicle_id
    if (data.quilometragem != null && !data.vehicle_id) {
      res.status(400).json({ error: 'quilometragem requer vehicle_id' });
      return;
    }

    // Validate vehicle_id belongs to tenant
    if (data.vehicle_id) {
      const vehicle = await validateVehicleTenant(data.vehicle_id, tenantId);
      if (!vehicle) {
        res.status(400).json({ error: 'Veículo não encontrado neste estabelecimento' });
        return;
      }
    }

    // Validate service_ids belong to tenant
    if (serviceIds) {
      const invalidId = await validateServiceIdsTenant(serviceIds, tenantId);
      if (invalidId) {
        res.status(400).json({ error: `Serviço não encontrado: ${invalidId}` });
        return;
      }
    }

    const conflict = await hasTimeConflict(
      tenantId,
      data.location_id,
      dataHora,
      data.duracao_minutos,
    );

    if (conflict) {
      res.status(409).json({ error: 'Horário indisponível' });
      return;
    }

    // Use transaction to create appointment + AppointmentService records atomically
    const result = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          tenant_id: tenantId,
          client_id: data.client_id ?? null,
          service_id: legacyServiceId ?? null,
          location_id: data.location_id,
          vehicle_id: data.vehicle_id ?? null,
          data_hora: dataHora,
          duracao_minutos: data.duracao_minutos,
          quilometragem: data.quilometragem ?? null,
          status: AppointmentStatus.AGENDADO,
          nome_visitante: data.nome_visitante ?? null,
          celular_visitante: data.celular_visitante ?? null,
          notas: data.notas ?? null,
          desconto: data.desconto ?? null,
          forma_pagamento: (data.forma_pagamento as FormaPagamento) ?? null,
          valor_servico: data.valor_servico ?? null,
        },
      });

      // Create AppointmentService records
      const idsToLink = serviceIds ?? (legacyServiceId ? [legacyServiceId] : []);
      if (idsToLink.length > 0) {
        await tx.appointmentService.createMany({
          data: idsToLink.map((sid) => ({
            appointment_id: appointment.id,
            service_id: sid,
          })),
        });
      }

      // Re-fetch with includes
      return tx.appointment.findUnique({
        where: { id: appointment.id },
        include: {
          appointmentServices: {
            include: {
              service: {
                select: { id: true, nome: true, duracao_minutos: true, valor: true },
              },
            },
          },
        },
      });
    });

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Create appointment error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /appointments — List appointments by period (query params: start, end).
 * When neither start nor end is provided, applies default ±30 day filter.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;

    const where: Record<string, unknown> = { tenant_id: tenantId };

    if (start || end) {
      // Explicit date filter
      const dateFilter: Record<string, Date> = {};
      if (start) dateFilter.gte = new Date(start);
      if (end) dateFilter.lte = new Date(end);
      where.data_hora = dateFilter;
    } else {
      // Default ±30 day filter
      const defaultRange = getDefaultDateRange();
      where.data_hora = {
        gte: defaultRange.start,
        lte: defaultRange.end,
      };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { data_hora: 'asc' },
      include: {
        client: { select: { id: true, nome: true } },
        service: { select: { id: true, nome: true, duracao_minutos: true, valor: true } },
        location: { select: { id: true, endereco_rua: true, endereco_numero: true } },
        appointmentServices: {
          include: {
            service: {
              select: { id: true, nome: true, duracao_minutos: true, valor: true },
            },
          },
        },
        vehicle: {
          select: { id: true, marca: true, modelo: true, placa: true, cor: true },
        },
      },
    });

    res.status(200).json(appointments);
  } catch (err) {
    logger.error('List appointments error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /appointments/:appointmentId — Update an appointment with conflict check.
 */
router.put(
  '/:appointmentId',
  async (req: Request<{ appointmentId: string }>, res: Response) => {
    try {
      const data = updateAppointmentSchema.parse(req.body);
      const tenantId = req.context!.tenant_id!;
      const appointmentId = req.params.appointmentId;

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
      });

      if (!appointment || appointment.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Agendamento não encontrado' });
        return;
      }

      // Validate quilometragem requires vehicle_id
      const effectiveVehicleId = data.vehicle_id !== undefined ? data.vehicle_id : appointment.vehicle_id;
      if (data.quilometragem != null && !effectiveVehicleId) {
        res.status(400).json({ error: 'quilometragem requer vehicle_id' });
        return;
      }

      // Validate vehicle_id belongs to tenant
      if (data.vehicle_id) {
        const vehicle = await validateVehicleTenant(data.vehicle_id, tenantId);
        if (!vehicle) {
          res.status(400).json({ error: 'Veículo não encontrado neste estabelecimento' });
          return;
        }
      }

      // Validate service_ids belong to tenant
      if (data.service_ids) {
        const invalidId = await validateServiceIdsTenant(data.service_ids, tenantId);
        if (invalidId) {
          res.status(400).json({ error: `Serviço não encontrado: ${invalidId}` });
          return;
        }
      }

      // Determine values for conflict check
      const newDataHora = data.data_hora
        ? new Date(data.data_hora)
        : appointment.data_hora;
      const newDuracao = data.duracao_minutos ?? appointment.duracao_minutos;
      const newLocationId = data.location_id ?? appointment.location_id;

      // Check conflict if time, duration, or location changed
      if (data.data_hora || data.duracao_minutos || data.location_id) {
        const conflict = await hasTimeConflict(
          tenantId,
          newLocationId,
          newDataHora,
          newDuracao,
          appointmentId,
        );

        if (conflict) {
          res.status(409).json({ error: 'Horário indisponível' });
          return;
        }
      }

      // Use transaction if service_ids need updating
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            ...(data.client_id !== undefined && { client_id: data.client_id }),
            ...(data.service_id !== undefined && { service_id: data.service_id }),
            ...(data.location_id !== undefined && { location_id: data.location_id }),
            ...(data.data_hora !== undefined && { data_hora: new Date(data.data_hora) }),
            ...(data.duracao_minutos !== undefined && { duracao_minutos: data.duracao_minutos }),
            ...(data.nome_visitante !== undefined && { nome_visitante: data.nome_visitante }),
            ...(data.celular_visitante !== undefined && {
              celular_visitante: data.celular_visitante,
            }),
            ...(data.notas !== undefined && { notas: data.notas }),
            ...(data.desconto !== undefined && { desconto: data.desconto }),
            ...(data.forma_pagamento !== undefined && { forma_pagamento: data.forma_pagamento as FormaPagamento }),
            ...(data.valor_servico !== undefined && { valor_servico: data.valor_servico }),
            ...(data.vehicle_id !== undefined && { vehicle_id: data.vehicle_id }),
            ...(data.quilometragem !== undefined && { quilometragem: data.quilometragem }),
          },
        });

        // Replace AppointmentService records if service_ids provided
        if (data.service_ids) {
          await tx.appointmentService.deleteMany({
            where: { appointment_id: appointmentId },
          });
          await tx.appointmentService.createMany({
            data: data.service_ids.map((sid) => ({
              appointment_id: appointmentId,
              service_id: sid,
            })),
          });
        }

        return updated;
      });

      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Dados inválidos', details: err.errors });
        return;
      }
      logger.error('Update appointment error', { error: String(err) });
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

/**
 * PATCH /appointments/:appointmentId/status — Update appointment status.
 * When status changes to CONCLUIDO and appointment has vehicle_id + quilometragem,
 * updates the vehicle's quilometragem if the appointment value is greater.
 */
router.patch(
  '/:appointmentId/status',
  async (req: Request<{ appointmentId: string }>, res: Response) => {
    try {
      const tenantId = req.context!.tenant_id!;
      const appointmentId = req.params.appointmentId;
      const { status } = req.body as { status: string };

      const validStatuses: string[] = [
        AppointmentStatus.AGENDADO,
        AppointmentStatus.CONFIRMADO,
        AppointmentStatus.EM_ANDAMENTO,
        AppointmentStatus.CONCLUIDO,
        AppointmentStatus.CANCELADO,
      ];

      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ error: 'Status inválido' });
        return;
      }

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
      });

      if (!appointment || appointment.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Agendamento não encontrado' });
        return;
      }

      // Use transaction for atomicity when completing with vehicle quilometragem
      if (
        status === AppointmentStatus.CONCLUIDO &&
        appointment.vehicle_id &&
        appointment.quilometragem != null
      ) {
        const result = await prisma.$transaction(async (tx) => {
          const updated = await tx.appointment.update({
            where: { id: appointmentId },
            data: { status: status as AppointmentStatus },
          });

          const vehicle = await tx.vehicle.findUnique({
            where: { id: appointment.vehicle_id! },
            select: { quilometragem: true },
          });

          if (
            vehicle &&
            (vehicle.quilometragem == null ||
              appointment.quilometragem! > vehicle.quilometragem)
          ) {
            await tx.vehicle.update({
              where: { id: appointment.vehicle_id! },
              data: { quilometragem: appointment.quilometragem },
            });
          }

          return updated;
        });

        res.status(200).json(result);
        return;
      }

      // Simple status update (no vehicle quilometragem logic)
      const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: status as AppointmentStatus },
      });

      res.status(200).json(updated);
    } catch (err) {
      logger.error('Update appointment status error', { error: String(err) });
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

/**
 * PATCH /appointments/:appointmentId/cancel — Cancel an appointment.
 */
router.patch(
  '/:appointmentId/cancel',
  async (req: Request<{ appointmentId: string }>, res: Response) => {
    try {
      const tenantId = req.context!.tenant_id!;
      const appointmentId = req.params.appointmentId;

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
      });

      if (!appointment || appointment.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Agendamento não encontrado' });
        return;
      }

      const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CANCELADO },
      });

      res.status(200).json(updated);
    } catch (err) {
      logger.error('Cancel appointment error', { error: String(err) });
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

/**
 * DELETE /appointments/:appointmentId — Delete an appointment.
 */
router.delete(
  '/:appointmentId',
  async (req: Request<{ appointmentId: string }>, res: Response) => {
    try {
      const tenantId = req.context!.tenant_id!;
      const appointmentId = req.params.appointmentId;

      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
      });

      if (!appointment || appointment.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Agendamento não encontrado' });
        return;
      }

      await prisma.appointment.delete({ where: { id: appointmentId } });

      res.status(204).send();
    } catch (err) {
      logger.error('Delete appointment error', { error: String(err) });
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

/**
 * PATCH /appointments/:id/restore — Restore a soft-deleted appointment.
 */
router.patch('/:id/restore', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const record = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM appointments WHERE id = $1 AND tenant_id = $2`,
      req.params.id, tenantId
    );
    if (!record || record.length === 0) {
      res.status(404).json({ error: 'Registro não encontrado' });
      return;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE appointments SET deleted_at = NULL WHERE id = $1`,
      req.params.id
    );
    res.json({ message: 'Registro restaurado' });
  } catch (err) {
    logger.error('Restore appointment error', { error: String(err) });
    res.status(500).json({ error: 'Erro ao restaurar registro' });
  }
});

export default router;
