import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppointmentStatus } from '../generated/prisma/enums';
import { z } from 'zod';

const router = Router();

/**
 * Resolve tenant by slug. Returns tenant or null.
 */
async function resolveTenant(slug: string) {
  return prisma.tenant.findUnique({ where: { slug } });
}

/**
 * GET /public/:slug/profile — Public profile of the establishment.
 */
router.get('/:slug/profile', async (req: Request<{ slug: string }>, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant) {
      res.status(404).json({ error: 'Estabelecimento não encontrado' });
      return;
    }

    const company = await prisma.company.findUnique({
      where: { tenant_id: tenant.id },
      select: { nome: true, logo_url: true, descricao: true },
    });

    if (!company) {
      res.status(404).json({ error: 'Estabelecimento não encontrado' });
      return;
    }

    res.status(200).json(company);
  } catch (err) {
    logger.error('Public profile error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /public/:slug/services — List active services for the establishment.
 */
router.get('/:slug/services', async (req: Request<{ slug: string }>, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant) {
      res.status(404).json({ error: 'Estabelecimento não encontrado' });
      return;
    }

    const services = await prisma.service.findMany({
      where: { tenant_id: tenant.id, ativo: true },
      select: {
        id: true,
        nome: true,
        descricao: true,
        foto_url: true,
        duracao_minutos: true,
        valor: true,
      },
      orderBy: { created_at: 'asc' },
    });

    res.status(200).json(services);
  } catch (err) {
    logger.error('Public services error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /public/:slug/whatsapp — WhatsApp link for the establishment owner.
 */
router.get('/:slug/whatsapp', async (req: Request<{ slug: string }>, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant) {
      res.status(404).json({ error: 'Estabelecimento não encontrado' });
      return;
    }

    const owner = await prisma.user.findFirst({
      where: { tenant_id: tenant.id, role: 'OWNER' },
      select: { celular: true },
    });

    if (!owner) {
      res.status(404).json({ error: 'Proprietário não encontrado' });
      return;
    }

    // Strip the '+' from the phone number for wa.me link
    const celularClean = owner.celular.replace(/\D/g, '');
    res.status(200).json({ link: `https://wa.me/${celularClean}` });
  } catch (err) {
    logger.error('Public whatsapp error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /public/:slug/locations — List all locations with addresses and business hours.
 */
router.get('/:slug/locations', async (req: Request<{ slug: string }>, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant) {
      res.status(404).json({ error: 'Estabelecimento não encontrado' });
      return;
    }

    const locations = await prisma.location.findMany({
      where: { tenant_id: tenant.id },
      select: {
        id: true,
        endereco_rua: true,
        endereco_numero: true,
        endereco_complemento: true,
        endereco_bairro: true,
        endereco_cidade: true,
        endereco_estado: true,
        endereco_cep: true,
        is_primary: true,
        horario_abertura: true,
        horario_fechamento: true,
      },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
    });

    res.status(200).json(locations);
  } catch (err) {
    logger.error('Public locations error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /public/:slug/slots — Available time slots for a service on a given date.
 * Query params: service_id (UUID), date (YYYY-MM-DD), location_id (optional UUID)
 */
router.get('/:slug/slots', async (req: Request<{ slug: string }>, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params.slug);
    if (!tenant) {
      res.status(404).json({ error: 'Estabelecimento não encontrado' });
      return;
    }

    const serviceId = req.query.service_id as string;
    const dateStr = req.query.date as string;
    const locationId = req.query.location_id as string | undefined;

    if (!serviceId || !dateStr) {
      res.status(400).json({ error: 'service_id e date são obrigatórios' });
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD' });
      return;
    }

    // Validate date is today or future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestedDate = new Date(dateStr + 'T00:00:00.000Z');
    if (requestedDate < today) {
      res.status(400).json({ error: 'Data deve ser hoje ou futura' });
      return;
    }

    // Validate service exists and is active
    const service = await prisma.service.findFirst({
      where: { id: serviceId, tenant_id: tenant.id },
    });

    if (!service || !service.ativo) {
      res.status(400).json({ error: 'Serviço não disponível' });
      return;
    }

    // Get location: use provided location_id or fall back to primary
    let location;
    if (locationId) {
      location = await prisma.location.findFirst({
        where: { id: locationId, tenant_id: tenant.id },
      });
    } else {
      location = await prisma.location.findFirst({
        where: { tenant_id: tenant.id, is_primary: true },
      });
    }

    if (!location) {
      res.status(500).json({ error: 'Localização não encontrada' });
      return;
    }

    // Use location's business hours instead of hardcoded values
    const dayStart = new Date(dateStr + `T${location.horario_abertura}:00.000Z`);
    const dayEnd = new Date(dateStr + `T${location.horario_fechamento}:00.000Z`);

    // Fetch active appointments for the day at this location
    const appointments = await prisma.appointment.findMany({
      where: {
        tenant_id: tenant.id,
        location_id: location.id,
        status: { notIn: [AppointmentStatus.CANCELADO, AppointmentStatus.CONCLUIDO] },
        data_hora: { gte: dayStart, lt: dayEnd },
      },
      select: { data_hora: true, duracao_minutos: true },
    });

    // Generate slots
    const intervalMinutes = service.duracao_minutos;
    const slots: string[] = [];
    let slotStart = dayStart.getTime();
    const endLimit = dayEnd.getTime();

    while (slotStart + intervalMinutes * 60 * 1000 <= endLimit) {
      const slotEnd = slotStart + intervalMinutes * 60 * 1000;

      const hasConflict = appointments.some((appt) => {
        const apptStart = new Date(appt.data_hora).getTime();
        const apptEnd = apptStart + appt.duracao_minutos * 60 * 1000;
        return slotStart < apptEnd && slotEnd > apptStart;
      });

      if (!hasConflict) {
        slots.push(new Date(slotStart).toISOString());
      }

      slotStart += intervalMinutes * 60 * 1000;
    }

    res.status(200).json(slots);
  } catch (err) {
    logger.error('Public slots error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Zod schema for public appointment creation.
 */
const publicAppointmentSchema = z.object({
  nome_visitante: z.string().min(1, 'nome_visitante é obrigatório'),
  celular_visitante: z.string().min(1, 'celular_visitante é obrigatório'),
  service_id: z.string().uuid('service_id inválido'),
  data_hora: z.string().datetime({ message: 'data_hora deve ser ISO 8601' }),
  location_id: z.string().uuid('location_id inválido').optional(),
});

/**
 * POST /public/:slug/appointments — Create a public appointment.
 */
router.post('/:slug/appointments', async (req: Request<{ slug: string }>, res: Response) => {
  try {
    const data = publicAppointmentSchema.parse(req.body);

    const tenant = await resolveTenant(req.params.slug);
    if (!tenant) {
      res.status(404).json({ error: 'Estabelecimento não encontrado' });
      return;
    }

    // Validate service is active
    const service = await prisma.service.findFirst({
      where: { id: data.service_id, tenant_id: tenant.id },
    });

    if (!service || !service.ativo) {
      res.status(400).json({ error: 'Serviço não disponível' });
      return;
    }

    // Validate data_hora is in the future
    const dataHora = new Date(data.data_hora);
    if (dataHora <= new Date()) {
      res.status(400).json({ error: 'Data deve ser futura' });
      return;
    }

    // Get location: use provided location_id or fall back to primary
    let location;
    if (data.location_id) {
      location = await prisma.location.findFirst({
        where: { id: data.location_id, tenant_id: tenant.id },
      });
    } else {
      location = await prisma.location.findFirst({
        where: { tenant_id: tenant.id, is_primary: true },
      });
    }

    if (!location) {
      res.status(500).json({ error: 'Localização não encontrada' });
      return;
    }

    // Check time conflict
    const endTime = new Date(dataHora.getTime() + service.duracao_minutos * 60 * 1000);

    const conflicts = await prisma.appointment.findMany({
      where: {
        tenant_id: tenant.id,
        location_id: location.id,
        status: { notIn: [AppointmentStatus.CANCELADO, AppointmentStatus.CONCLUIDO] },
      },
      select: { data_hora: true, duracao_minutos: true },
    });

    const hasConflict = conflicts.some((appt) => {
      const apptStart = new Date(appt.data_hora).getTime();
      const apptEnd = apptStart + appt.duracao_minutos * 60 * 1000;
      return dataHora.getTime() < apptEnd && endTime.getTime() > apptStart;
    });

    if (hasConflict) {
      res.status(409).json({ error: 'Horário indisponível' });
      return;
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        tenant_id: tenant.id,
        client_id: null,
        service_id: data.service_id,
        location_id: location.id,
        data_hora: dataHora,
        duracao_minutos: service.duracao_minutos,
        status: AppointmentStatus.AGENDADO,
        nome_visitante: data.nome_visitante,
        celular_visitante: data.celular_visitante,
      },
    });

    res.status(201).json(appointment);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Public appointment error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
