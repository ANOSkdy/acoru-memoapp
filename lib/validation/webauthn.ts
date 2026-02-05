import { z } from 'zod';

export const registrationVerifySchema = z.object({
  attestationResponse: z.any()
});

export const authenticationVerifySchema = z.object({
  assertionResponse: z.any()
});
