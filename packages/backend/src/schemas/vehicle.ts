import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const createVehicleSchema = z.object({
  marca: z.string().min(1, 'Marca é obrigatória'),
  modelo: z.string().min(1, 'Modelo é obrigatório'),
  ano: z
    .number()
    .int()
    .min(1900, 'Ano mínimo é 1900')
    .max(currentYear + 1, `Ano máximo é ${currentYear + 1}`),
  placa: z.string().min(1, 'Placa é obrigatória'),
  quilometragem: z.number().int().min(0).nullable().optional(),
  cor: z.string().min(1).nullable().optional(),
  client_id: z.string().uuid().optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = z.object({
  marca: z.string().min(1).optional(),
  modelo: z.string().min(1).optional(),
  ano: z
    .number()
    .int()
    .min(1900, 'Ano mínimo é 1900')
    .max(currentYear + 1, `Ano máximo é ${currentYear + 1}`)
    .optional(),
  placa: z.string().min(1).optional(),
  quilometragem: z.number().int().min(0).nullable().optional(),
  cor: z.string().min(1).nullable().optional(),
});

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
