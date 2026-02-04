import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { hashSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

const isProduction = process.env.NODE_ENV === 'production';

const getBypassUser = (): SessionUser | null => {
  if (isProduction) {
    return null;
  }

  if (process.env.DEV_AUTH_BYPASS !== 'true') {
    return null;
  }

  const id = process.env.DEV_AUTH_BYPASS_USER ?? 'dev-user';
  const name = process.env.DEV_AUTH_BYPASS_NAME ?? 'Dev User';
  const email = process.env.DEV_AUTH_BYPASS_EMAIL ?? 'dev@example.com';

  return { id, name, email };
};

export const getSessionUser = async (): Promise<SessionUser | null> => {
  const bypassUser = getBypassUser();
  if (bypassUser) {
    return bypassUser;
  }

  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token || !sql) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const rows = await sql`
    select
      users.id,
      coalesce(users.display_name, users.email) as name,
      users.email
    from sessions
    join users on sessions.user_id = users.id
    where sessions.token_hash = ${tokenHash}
      and (sessions.expires_at is null or sessions.expires_at > now())
    limit 1;
  `;

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email
  };
};

export const requireUser = async (): Promise<SessionUser> => {
  const user = await getSessionUser();

  if (!user) {
    redirect('/sign-in');
  }

  return user;
};
