import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';

export const getSessionTokenFromCookies = (): string | null =>
  cookies().get(SESSION_COOKIE_NAME)?.value ?? null;
