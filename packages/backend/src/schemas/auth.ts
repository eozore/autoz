import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .refine((val) => /[A-Z]/.test(val), {
    message: 'Senha deve conter pelo menos 1 letra maiúscula',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: 'Senha deve conter pelo menos 1 número',
  })
  .refine((val) => /[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/~`]/.test(val), {
    message: 'Senha deve conter pelo menos 1 caractere especial',
  });

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: passwordSchema,
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
  refresh_token: z.string().min(1, 'Refresh token é obrigatório'),
});

export type RefreshInput = z.infer<typeof refreshSchema>;
