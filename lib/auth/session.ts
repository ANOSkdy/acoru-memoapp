import 'server-only';

import { createHash, randomBytes } from 'crypto';

export const SESSION_COOKIE_NAME = 'acoru_session';

export const createSessionToken = () => randomBytes(32).toString('base64url');

export const hashSessionToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export const getSessionExpiration = () =>
  new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

export const getSessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/'
});
