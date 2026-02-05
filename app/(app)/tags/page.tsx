import { notFound } from 'next/navigation';

import TagsManager from './TagsManager';
import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

export default async function TagsPage() {
  if (!sql) {
    throw new Error('Database not configured.');
  }

  const user = await requireUser();
  const workspaceId = await getWorkspaceIdForUser(user.id);

  if (!workspaceId) {
    notFound();
  }

  const tags = (await sql`
    select
      id,
      name,
      color,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from tags
    where workspace_id = ${workspaceId}
    order by lower(name) asc
  `) as { id: string; name: string; color: string | null }[];

  return <TagsManager initialTags={tags} />;
}
