import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { signJwt } from '../lib/jwt';
import { generateSlug } from '../lib/slug';
import {
  createCompanySchema,
  updateCompanySchema,
  createLocationSchema,
  updateLocationSchema,
} from '../schemas/company';
import { ZodError } from 'zod';

const router = Router();

// ==================== COMPANY ENDPOINTS ====================

/**
 * POST /companies — Setup flow: create tenant + company + primary location.
 * Works WITHOUT tenant_id (user is setting up for the first time).
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    logger.debug('[POST /companies] body', { body: req.body });
    const data = createCompanySchema.parse(req.body);
    const userId = req.context!.user_id;

    // Verify user doesn't already have a tenant
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }
    if (user.tenant_id) {
      res.status(409).json({ error: 'Usuário já possui uma empresa configurada' });
      return;
    }

    const slug = await generateSlug(data.nome);

    // Create tenant, company, primary location, and update user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { slug },
      });

      const company = await tx.company.create({
        data: {
          tenant_id: tenant.id,
          nome: data.nome,
          logo_url: data.logo_url ?? null,
          descricao: data.descricao ?? null,
        },
      });

      const location = await tx.location.create({
        data: {
          tenant_id: tenant.id,
          company_id: company.id,
          endereco_rua: data.endereco.rua,
          endereco_numero: data.endereco.numero,
          endereco_complemento: data.endereco.complemento ?? null,
          endereco_bairro: data.endereco.bairro,
          endereco_cidade: data.endereco.cidade,
          endereco_estado: data.endereco.estado,
          endereco_cep: data.endereco.cep,
          is_primary: true,
          horario_abertura: data.horario_abertura,
          horario_fechamento: data.horario_fechamento,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { tenant_id: tenant.id },
      });

      return { tenant, company, location };
    });

    // Emit new JWT with tenant_id
    const token = signJwt({
      user_id: userId,
      tenant_id: result.tenant.id,
      role: user.role,
    });

    res.status(201).json({
      token,
      company: result.company,
      location: result.location,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      logger.debug('[POST /companies] validation error', { details: err.errors });
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Create company error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /companies/me — Get the current user's company.
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;

    const company = await prisma.company.findUnique({
      where: { tenant_id: tenantId },
      include: { locations: true, tenant: { select: { slug: true } } },
    });

    if (!company) {
      res.status(404).json({ error: 'Empresa não encontrada' });
      return;
    }

    res.status(200).json(company);
  } catch (err) {
    logger.error('Get company error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /companies/:companyId — Update company details.
 */
router.put('/:companyId', async (req: Request<{ companyId: string }>, res: Response) => {
  try {
    const data = updateCompanySchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;
    const companyId = req.params.companyId;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company || company.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Empresa não encontrada' });
      return;
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.logo_url !== undefined && { logo_url: data.logo_url }),
        ...(data.descricao !== undefined && { descricao: data.descricao }),
      },
    });

    res.status(200).json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Update company error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==================== LOCATION ENDPOINTS ====================

/**
 * POST /companies/:companyId/locations — Create a new location.
 */
router.post('/:companyId/locations', async (req: Request<{ companyId: string }>, res: Response) => {
  try {
    const data = createLocationSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;
    const companyId = req.params.companyId;

    // Verify company belongs to tenant
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company || company.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Empresa não encontrada' });
      return;
    }

    const location = await prisma.location.create({
      data: {
        tenant_id: tenantId,
        company_id: companyId,
        endereco_rua: data.rua,
        endereco_numero: data.numero,
        endereco_complemento: data.complemento ?? null,
        endereco_bairro: data.bairro,
        endereco_cidade: data.cidade,
        endereco_estado: data.estado,
        endereco_cep: data.cep,
        is_primary: false,
        horario_abertura: data.horario_abertura,
        horario_fechamento: data.horario_fechamento,
      },
    });

    res.status(201).json(location);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Create location error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /companies/:companyId/locations — List locations for a company.
 */
router.get('/:companyId/locations', async (req: Request<{ companyId: string }>, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const companyId = req.params.companyId;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company || company.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Empresa não encontrada' });
      return;
    }

    const locations = await prisma.location.findMany({
      where: { tenant_id: tenantId, company_id: companyId },
      orderBy: { created_at: 'asc' },
    });

    res.status(200).json(locations);
  } catch (err) {
    logger.error('List locations error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /locations/:locationId — Update a location's address.
 */
router.put('/locations/:locationId', async (req: Request<{ locationId: string }>, res: Response) => {
  try {
    const data = updateLocationSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;
    const locationId = req.params.locationId;

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location || location.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Localização não encontrada' });
      return;
    }

    const updated = await prisma.location.update({
      where: { id: locationId },
      data: {
        ...(data.rua !== undefined && { endereco_rua: data.rua }),
        ...(data.numero !== undefined && { endereco_numero: data.numero }),
        ...(data.complemento !== undefined && { endereco_complemento: data.complemento }),
        ...(data.bairro !== undefined && { endereco_bairro: data.bairro }),
        ...(data.cidade !== undefined && { endereco_cidade: data.cidade }),
        ...(data.estado !== undefined && { endereco_estado: data.estado }),
        ...(data.cep !== undefined && { endereco_cep: data.cep }),
        ...(data.horario_abertura !== undefined && { horario_abertura: data.horario_abertura }),
        ...(data.horario_fechamento !== undefined && { horario_fechamento: data.horario_fechamento }),
      },
    });

    res.status(200).json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    logger.error('Update location error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /locations/:locationId — Delete a location (prevent deleting primary).
 */
router.delete('/locations/:locationId', async (req: Request<{ locationId: string }>, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const locationId = req.params.locationId;

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location || location.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Localização não encontrada' });
      return;
    }

    if (location.is_primary) {
      res.status(400).json({ error: 'Não é possível excluir a localização primária' });
      return;
    }

    await prisma.location.delete({ where: { id: locationId } });

    res.status(204).send();
  } catch (err) {
    logger.error('Delete location error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
