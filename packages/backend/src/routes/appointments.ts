import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { createAppointmentSchema, updateAppointmentSchema } from '../schemas/appointment';
import { ZodError } from 'zod';
import { AppointmentStatus } from '../generated/prisma/enums';

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
 * POST /appointments — Create a new appointment with conflict check.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createAppointmentSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;
    const dataHora = new Date(data.data_hora);

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

    const appointment = await prisma.appointment.create({
      data: {
        tenant_id: tenantId,
        client_id: data.client_id ?? null,
        service_id: data.service_id,
        location_id: data.location_id,
        data_hora: dataHora,
        duracao_minutos: data.duracao_minutos,
        status: AppointmentStatus.AGENDADO,
        nome_visitante: data.nome_visitante ?? null,
        celular_visitante: data.celular_visitante ?? null,
        notas: data.notas ?? null,
        desconto: data.desconto ?? null,
        forma_pagamento: data.forma_pagamento ?? null,
        valor_servico: data.valor_servico ?? null,
      },
    });

    res.status(201).json(appointment);
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
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;

    const where: Record<string, unknown> = { tenant_id: tenantId };

    if (start || end) {
      const dateFilter: Record<string, Date> = {};
      if (start) dateFilter.gte = new Date(start);
      if (end) dateFilter.lte = new Date(end);
      where.data_hora = dateFilter;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { data_hora: 'asc' },
      include: {
        client: { select: { id: true, nome: true } },
        service: { select: { id: true, nome: true, duracao_minutos: true, valor: true } },
        location: { select: { id: true, endereco_rua: true, endereco_numero: true } },
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

      const updated = await prisma.appointment.update({
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
          ...(data.forma_pagamento !== undefined && { forma_pagamento: data.forma_pagamento }),
          ...(data.valor_servico !== undefined && { valor_servico: data.valor_servico }),
        },
      });

      res.status(200).json(updated);
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

export default router;
