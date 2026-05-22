import { z } from 'zod';

export const createInventoryItemSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().max(2000, 'descricao: máximo 2000 caracteres').nullable().optional(),
  custo: z.number().min(0, 'Custo deve ser >= 0'),
  valor_venda: z.number().min(0, 'Valor de venda deve ser >= 0'),
  tipo: z.enum(['USO', 'VENDA']),
  quantidade_inicial: z.number().int().min(0, 'Quantidade deve ser >= 0'),
  quantidade_minima: z.number().int().min(0).optional(),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

export const updateInventoryItemSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().max(2000, 'descricao: máximo 2000 caracteres').nullable().optional(),
  custo: z.number().min(0).optional(),
  valor_venda: z.number().min(0).optional(),
  quantidade_minima: z.number().int().min(0).optional(),
});

export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

export const createMovementSchema = z.object({
  tipo: z.enum(['ENTRADA', 'SAIDA_USO', 'SAIDA_VENDA']),
  quantidade: z.number().int().min(1, 'Quantidade deve ser >= 1'),
  referencia_tipo: z.enum(['SERVICO', 'VENDA', 'MANUAL']).nullable().optional(),
  referencia_id: z.string().uuid().nullable().optional(),
  notas: z.string().max(2000, 'notas: máximo 2000 caracteres').nullable().optional(),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
