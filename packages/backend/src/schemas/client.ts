import { z } from 'zod';

export const createClientSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido').nullable().optional(),
  celular: z
    .string()
    .regex(/^\+55\d{10,11}$/, 'Celular deve estar no formato brasileiro (+55 seguido de 10-11 dígitos)'),
  data_nascimento: z.string().date().nullable().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  nome: z.string().min(1).optional(),
  email: z.string().email('Email inválido').nullable().optional(),
  celular: z
    .string()
    .regex(/^\+55\d{10,11}$/, 'Celular deve estar no formato brasileiro (+55 seguido de 10-11 dígitos)')
    .optional(),
  data_nascimento: z.string().date().nullable().optional(),
});

export type UpdateClientInput = z.infer<typeof updateClientSchema>;
