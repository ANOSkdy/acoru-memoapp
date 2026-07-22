import 'server-only';

import { cache } from 'react';

import { sql } from '@/lib/db';

/** Memoized per request: repeated calls in one render share a single query. */
export const getWorkspaceIdForUser = cache(async (
  userId: string
): Promise<string | null> => {
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select id
    from workspaces
    where owner_user_id = ${userId}
    limit 1
  `;

  const workspaceId = rows[0]?.id as string | undefined;
  return workspaceId ?? null;
});
