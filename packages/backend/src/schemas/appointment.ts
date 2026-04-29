import { z } from 'zod';

export const createAppointmentSchema = z.object({
  client_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid('service_id inválido').optional(),
  service_ids: z.array(z.string().uuid()).min(1).optional(),
  location_id: z.string().uuid('location_id inválido'),
  data_hora: z.string().datetime({ message: 'data_hora deve ser ISO 8601' }),
  duracao_minutos: z.number().int().min(1, 'Duração deve ser >= 1'),
  nome_visitante: z.string().nullable().optional(),
  celular_visitante: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  desconto: z.number().min(0).optional().nullable(),
  forma_pagamento: z.string().optional().nullable(),
  valor_servico: z.number().min(0).optional().nullable(),
  vehicle_id: z.string().uuid().nullable().optional(),
  quilometragem: z.number().int().min(0).nullable().optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = z.object({
  client_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid().optional(),
  service_ids: z.array(z.string().uuid()).min(1).optional(),
  location_id: z.string().uuid().optional(),
  data_hora: z.string().datetime().optional(),
  duracao_minutos: z.number().int().min(1).optional(),
  nome_visitante: z.string().nullable().optional(),
  celular_visitante: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  desconto: z.number().min(0).optional().nullable(),
  forma_pagamento: z.string().optional().nullable(),
  valor_servico: z.number().min(0).optional().nullable(),
  vehicle_id: z.string().uuid().nullable().optional(),
  quilometragem: z.number().int().min(0).nullable().optional(),
});

export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
