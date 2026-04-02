import { z } from 'zod';

const enderecoSchema = z.object({
  rua: z.string().min(1, 'Rua é obrigatória'),
  numero: z.string().min(1, 'Número é obrigatório'),
  complemento: z.string().nullable().optional(),
  bairro: z.string().min(1, 'Bairro é obrigatório'),
  cidade: z.string().min(1, 'Cidade é obrigatória'),
  estado: z.string().min(1, 'Estado é obrigatório'),
  cep: z.string().min(1, 'CEP é obrigatório'),
});

export const createCompanySchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  logo_url: z.string().nullable().optional(),
  descricao: z.string().nullable().optional(),
  endereco: enderecoSchema,
  horario_abertura: z.string().optional().default('08:00'),
  horario_fechamento: z.string().optional().default('18:00'),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = z.object({
  nome: z.string().min(1).optional(),
  logo_url: z.string().nullable().optional(),
  descricao: z.string().nullable().optional(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const createLocationSchema = enderecoSchema.extend({
  horario_abertura: z.string().optional().default('08:00'),
  horario_fechamento: z.string().optional().default('18:00'),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = enderecoSchema.partial().extend({
  horario_abertura: z.string().optional(),
  horario_fechamento: z.string().optional(),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
