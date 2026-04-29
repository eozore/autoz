import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { createVehicleSchema, updateVehicleSchema } from '../schemas/vehicle';
import { vehicleTransferSchema } from '../schemas/vehicleTransfer';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client';

const router = Router();

// ==================== TOP-LEVEL VEHICLE ENDPOINTS ====================

/**
 * GET /vehicles — List all vehicles for the tenant with cursor-based pagination and search.
 */
router.get('/vehicles', async (req: Request, res: Response) => {
  try {
    const tenantId = req.context!.tenant_id!;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = req.query.search as string | undefined;

    const where: Prisma.VehicleWhereInput = { tenant_id: tenantId };

    if (search) {
      where.OR = [
        { placa: { contains: search, mode: 'insensitive' } },
        { marca: { contains: search, mode: 'insensitive' } },
        { modelo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { created_at: 'asc' },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      include: {
        client: { select: { id: true, nome: true } },
      },
    });

    const hasMore = vehicles.length > limit;
    const data = hasMore ? vehicles.slice(0, limit) : vehicles;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    res.status(200).json({ data, nextCursor });
  } catch (err) {
    logger.error('List vehicles error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /vehicles/:vehicleId — Get a single vehicle with client data and ownership history.
 */
router.get(
  '/vehicles/:vehicleId',
  async (req: Request<{ vehicleId: string }>, res: Response) => {
    try {
      const tenantId = req.context!.tenant_id!;
      const vehicleId = req.params.vehicleId;

      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: {
          client: { select: { id: true, nome: true } },
          ownershipHistory: {
            orderBy: { started_at: 'desc' },
            include: {
              client: { select: { id: true, nome: true } },
            },
          },
        },
      });

      if (!vehicle || vehicle.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Veículo não encontrado' });
        return;
      }

      res.status(200).json(vehicle);
    } catch (err) {
      logger.error('Get vehicle error', { error: String(err) });
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

/**
 * POST /vehicles — Create a vehicle (top-level, requires client_id in body).
 */
router.post('/vehicles', async (req: Request, res: Response) => {
  try {
    const data = createVehicleSchema.parse(req.body);
    const tenantId = req.context!.tenant_id!;

    if (!data.client_id) {
      res.status(400).json({ error: 'Dados inválidos', details: [{ message: 'client_id é obrigatório' }] });
      return;
    }

    // Verify client belongs to tenant
    const client = await prisma.client.findUnique({ where: { id: data.client_id } });
    if (!client || client.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        tenant_id: tenantId,
        client_id: data.client_id,
        marca: data.marca,
        modelo: data.modelo,
        ano: data.ano,
        placa: data.placa,
        ...(data.quilometragem !== undefined && { quilometragem: data.quilometragem }),
        ...(data.cor !== undefined && { cor: data.cor }),
      },
    });

    res.status(201).json(vehicle);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: err.errors });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Placa já cadastrada neste estabelecimento' });
      return;
    }
    logger.error('Create vehicle error', { error: String(err) });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PATCH /vehicles/:vehicleId/transfer — Transfer vehicle ownership to another client.
 */
router.patch(
  '/vehicles/:vehicleId/transfer',
  async (req: Request<{ vehicleId: string }>, res: Response) => {
    try {
      const data = vehicleTransferSchema.parse(req.body);
      const tenantId = req.context!.tenant_id!;
      const vehicleId = req.params.vehicleId;

      // Fetch vehicle and validate tenant
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle || vehicle.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Veículo não encontrado' });
        return;
      }

      // Fetch new client and validate tenant
      const newClient = await prisma.client.findUnique({ where: { id: data.client_id } });
      if (!newClient || newClient.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
      }

      // Validate new client_id ≠ current client_id
      if (data.client_id === vehicle.client_id) {
        res.status(400).json({ error: 'Veículo já pertence a este cliente' });
        return;
      }

      // Execute transfer in a transaction
      const updatedVehicle = await prisma.$transaction(async (tx) => {
        // Close existing ownership record (set ended_at = now)
        await tx.vehicleOwnershipHistory.updateMany({
          where: {
            vehicle_id: vehicleId,
            client_id: vehicle.client_id,
            ended_at: null,
          },
          data: { ended_at: new Date() },
        });

        // Create new ownership record
        await tx.vehicleOwnershipHistory.create({
          data: {
            vehicle_id: vehicleId,
            client_id: data.client_id,
            started_at: new Date(),
          },
        });

        // Update vehicle's client_id
        return tx.vehicle.update({
          where: { id: vehicleId },
          data: { client_id: data.client_id },
          include: {
            client: { select: { id: true, nome: true } },
          },
        });
      });

      res.status(200).json(updatedVehicle);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Dados inválidos', details: err.errors });
        return;
      }
      logger.error('Transfer vehicle error', { error: String(err) });
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

// ==================== EXISTING ENDPOINTS (NESTED + BY ID) ====================

/**
 * POST /clients/:clientId/vehicles — Create a vehicle linked to a client.
 */
router.post(
  '/clients/:clientId/vehicles',
  async (req: Request<{ clientId: string }>, res: Response) => {
    try {
      const data = createVehicleSchema.parse(req.body);
      const tenantId = req.context!.tenant_id!;
      const clientId = req.params.clientId;

      // Verify client belongs to tenant
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client || client.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
      }

      const vehicle = await prisma.vehicle.create({
        data: {
          tenant_id: tenantId,
          client_id: clientId,
          marca: data.marca,
          modelo: data.modelo,
          ano: data.ano,
          placa: data.placa,
          ...(data.quilometragem !== undefined && { quilometragem: data.quilometragem }),
          ...(data.cor !== undefined && { cor: data.cor }),
        },
      });

      res.status(201).json(vehicle);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Dados inválidos', details: err.errors });
        return;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.status(409).json({ error: 'Placa já cadastrada neste estabelecimento' });
        return;
      }
      logger.error('Create vehicle error', { error: String(err) });
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

/**
 * GET /clients/:clientId/vehicles — List vehicles for a client.
 */
router.get(
  '/clients/:clientId/vehicles',
  async (req: Request<{ clientId: string }>, res: Response) => {
    try {
      const tenantId = req.context!.tenant_id!;
      const clientId = req.params.clientId;

      // Verify client belongs to tenant
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client || client.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
      }

      const vehicles = await prisma.vehicle.findMany({
        where: { tenant_id: tenantId, client_id: clientId },
        orderBy: { created_at: 'asc' },
      });

      res.status(200).json(vehicles);
    } catch (err) {
      logger.error('List vehicles error', { error: String(err) });
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

/**
 * PUT /vehicles/:vehicleId — Update a vehicle.
 */
router.put(
  '/vehicles/:vehicleId',
  async (req: Request<{ vehicleId: string }>, res: Response) => {
    try {
      const data = updateVehicleSchema.parse(req.body);
      const tenantId = req.context!.tenant_id!;
      const vehicleId = req.params.vehicleId;

      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

      if (!vehicle || vehicle.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Veículo não encontrado' });
        return;
      }

      const updated = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          ...(data.marca !== undefined && { marca: data.marca }),
          ...(data.modelo !== undefined && { modelo: data.modelo }),
          ...(data.ano !== undefined && { ano: data.ano }),
          ...(data.placa !== undefined && { placa: data.placa }),
          ...(data.quilometragem !== undefined && { quilometragem: data.quilometragem }),
          ...(data.cor !== undefined && { cor: data.cor }),
        },
      });

      res.status(200).json(updated);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Dados inválidos', details: err.errors });
        return;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.status(409).json({ error: 'Placa já cadastrada neste estabelecimento' });
        return;
      }
      logger.error('Update vehicle error', { error: String(err) });
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

/**
 * DELETE /vehicles/:vehicleId — Delete a vehicle.
 */
router.delete(
  '/vehicles/:vehicleId',
  async (req: Request<{ vehicleId: string }>, res: Response) => {
    try {
      const tenantId = req.context!.tenant_id!;
      const vehicleId = req.params.vehicleId;

      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

      if (!vehicle || vehicle.tenant_id !== tenantId) {
        res.status(404).json({ error: 'Veículo não encontrado' });
        return;
      }

      await prisma.vehicle.delete({ where: { id: vehicleId } });

      res.status(204).send();
    } catch (err) {
      logger.error('Delete vehicle error', { error: String(err) });
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },
);

export default router;
