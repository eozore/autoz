import { z } from 'zod';

export const createServiceSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().max(2000, 'descricao: máximo 2000 caracteres').nullable().optional(),
  foto_url: z.string().nullable().optional(),
  duracao_minutos: z.number().int().positive().optional().default(60),
  valor: z.number().positive().optional().nullable(),
  categoria: z.string().max(100).nullable().optional(),
  ativo: z.boolean().optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().max(2000, 'descricao: máximo 2000 caracteres').nullable().optional(),
  foto_url: z.string().nullable().optional(),
  duracao_minutos: z.number().int().positive().optional(),
  valor: z.number().positive().optional().nullable(),
  categoria: z.string().max(100).nullable().optional(),
  ativo: z.boolean().optional(),
});

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
