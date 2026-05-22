import { z } from 'zod';

const VALID_STEPS = [
  'company_profile',
  'services_setup',
  'location_setup',
  'first_client',
  'first_appointment',
  'public_page_activation',
  'first_review_received',
] as const;

export const completeStepSchema = z.object({
  step: z.enum(VALID_STEPS, {
    errorMap: () => ({ message: 'Step inválido' }),
  }),
});

export type CompleteStepInput = z.infer<typeof completeStepSchema>;
