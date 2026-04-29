import { z } from 'zod';

export const vehicleTransferSchema = z.object({
  client_id: z.string().uuid('client_id inválido'),
});

export type VehicleTransferInput = z.infer<typeof vehicleTransferSchema>;
