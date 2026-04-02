import { z } from 'zod';

export const createBillSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  valor: z.number().min(0, 'Valor deve ser >= 0'),
  data_vencimento: z.string().date('Data de vencimento inválida'),
});

export type CreateBillInput = z.infer<typeof createBillSchema>;

export const updateBillSchema = z.object({
  descricao: z.string().min(1).optional(),
  valor: z.number().min(0).optional(),
  data_vencimento: z.string().date().optional(),
});

export type UpdateBillInput = z.infer<typeof updateBillSchema>;
