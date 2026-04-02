import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { createVehicleSchema, updateVehicleSchema } from '../schemas/vehicle';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client';

const router = Router();

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
