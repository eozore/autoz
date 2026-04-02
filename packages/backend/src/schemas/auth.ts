import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  nome: z.string().min(1, 'Nome é obrigatório'),
  idade: z.number().int('Idade deve ser um número inteiro').min(18, 'Idade mínima é 18 anos'),
  celular: z
    .string()
    .regex(/^\+55\d{10,11}$/, 'Celular deve estar no formato brasileiro (+55 seguido de 10-11 dígitos)'),
  foto_url: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha é obrigatória'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
});

export type RefreshInput = z.infer<typeof refreshSchema>;
