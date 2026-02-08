import 'server-only';

import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const isValidUuid = (
  value: string | null | undefined
): value is string => {
  if (!value) {
    return false;
  }
  return uuidSchema.safeParse(value).success;
};
