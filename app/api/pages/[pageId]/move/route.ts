import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const moveSchema = z.object({
  parentId: z.string().uuid().nullable()
});

export async function PATCH(
  request: Request,
  { params }: { params: { pageId: string } }
) {
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

  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const pageId = params.pageId;
  const parentId = parsed.data.parentId;

  if (parentId === pageId) {
    return NextResponse.json(
      { ok: false, error: 'Cannot move page into itself.' },
      { status: 400 }
    );
  }

  const pageRows = await sql`
    select id, parent_page_id as "parentId"
    from pages
    where id = ${pageId}
      and workspace_id = ${workspaceId}
      and is_deleted = false
  `;

  const page = pageRows[0];
  if (!page) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (parentId) {
    const parentRows = await sql`
      select id, kind
      from pages
      where id = ${parentId}
        and workspace_id = ${workspaceId}
        and is_deleted = false
    `;

    const parent = parentRows[0];
    if (!parent) {
      return NextResponse.json(
        { ok: false, error: 'Parent not found.' },
        { status: 404 }
      );
    }

    if (parent.kind !== 'folder') {
      return NextResponse.json(
        { ok: false, error: 'Parent must be a folder.' },
        { status: 400 }
      );
    }

    const cycleRows = await sql`
      with recursive ancestors as (
        select id, parent_page_id
        from pages
        where id = ${parentId}
          and workspace_id = ${workspaceId}
        union all
        select p.id, p.parent_page_id
        from pages p
        join ancestors a on p.id = a.parent_page_id
        where p.workspace_id = ${workspaceId}
      )
      select id
      from ancestors
      where id = ${pageId}
      limit 1
    `;

    if (cycleRows.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'Cannot move into descendant.' },
        { status: 400 }
      );
    }
  }

  if (page.parentId === parentId) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const positionRows = await sql`
    select coalesce(max(position), 0) as max
    from pages
    where workspace_id = ${workspaceId}
      and is_deleted = false
      and parent_page_id is not distinct from ${parentId}
  `;

  const nextPosition = Number(positionRows[0]?.max ?? 0) + 1;

  const result = await sql`
    update pages
    set parent_page_id = ${parentId},
        position = ${nextPosition},
        updated_at = now()
    where id = ${pageId}
      and workspace_id = ${workspaceId}
      and is_deleted = false
    returning id
  `;

  if (result.length === 0) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
