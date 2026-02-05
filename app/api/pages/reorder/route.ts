import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const reorderSchema = z.object({
  parentId: z.string().uuid().nullable(),
  orderedIds: z.array(z.string().uuid()).min(1)
});

export async function PATCH(request: Request) {
  if (!sql) {
    return NextResponse.json(
      { ok: false, error: 'Database not configured.' },
      { status: 503 }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(user.id);
  if (!workspaceId) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { parentId, orderedIds } = parsed.data;
  const rows = await sql`
    select id
    from pages
    where workspace_id = ${workspaceId}
      and is_deleted = false
      and parent_page_id is not distinct from ${parentId}
  `;

  const existingIds = new Set(rows.map((row) => row.id as string));
  if (existingIds.size !== orderedIds.length) {
    return NextResponse.json(
      { ok: false, error: 'Ordering list does not match existing items.' },
      { status: 400 }
    );
  }

  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      return NextResponse.json(
        { ok: false, error: 'Ordering list contains invalid items.' },
        { status: 400 }
      );
    }
  }

  await sql`begin`;

  try {
    for (const [index, id] of orderedIds.entries()) {
      await sql`
        update pages
        set position = ${index + 1},
            updated_at = now()
        where id = ${id}
          and workspace_id = ${workspaceId}
          and parent_page_id is not distinct from ${parentId}
      `;
    }

    await sql`commit`;
  } catch (error) {
    await sql`rollback`;
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
