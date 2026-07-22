import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { hashSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export type SessionContext = {
  user: SessionUser | null;
  workspaceId: string | null;
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

/**
 * Resolves the signed-in user and their workspace in a single round trip.
 * Memoized per request so a layout, a page and a nested component share one query.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const bypassUser = getBypassUser();
  if (bypassUser) {
    return {
      user: bypassUser,
      workspaceId: await getWorkspaceIdForUser(bypassUser.id)
    };
  }

  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token || !sql) {
    return { user: null, workspaceId: null };
  }

  const tokenHash = hashSessionToken(token);
  const rows = await sql`
    select
      users.id,
      coalesce(users.display_name, users.email) as name,
      users.email,
      workspaces.id as "workspaceId"
    from sessions
    join users on sessions.user_id = users.id
    left join workspaces on workspaces.owner_user_id = users.id
    where sessions.token_hash = ${tokenHash}
      and (sessions.expires_at is null or sessions.expires_at > now())
    limit 1;
  `;

  if (rows.length === 0) {
    return { user: null, workspaceId: null };
  }

  const row = rows[0];
  return {
    user: {
      id: row.id,
      name: row.name,
      email: row.email
    },
    workspaceId: (row.workspaceId as string | null) ?? null
  };
});

export const getSessionUser = async (): Promise<SessionUser | null> => {
  const { user } = await getSessionContext();
  return user;
};

export const requireUser = async (): Promise<SessionUser> => {
  const user = await getSessionUser();

  if (!user) {
    redirect('/sign-in');
  }

  return user;
};

/** requireUser + workspace resolution without a second round trip. */
export const requireSessionContext = async (): Promise<{
  user: SessionUser;
  workspaceId: string | null;
}> => {
  const { user, workspaceId } = await getSessionContext();

  if (!user) {
    redirect('/sign-in');
  }

  return { user, workspaceId };
};

export const isAdminUser = async (userId: string): Promise<boolean> => {
  if (!sql) {
    return false;
  }

  const rows = await sql`
    select is_admin
    from users
    where id = ${userId}
    limit 1;
  `;

  return Boolean(rows[0]?.is_admin);
};
