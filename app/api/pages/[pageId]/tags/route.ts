import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const requestSchema = z.object({
  tagIds: z.array(z.string().uuid()).default([])
});

export async function PUT(
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const pageId = params.pageId;
  const tagIds = Array.from(new Set(parsed.data.tagIds));

  await sql`begin`;

  try {
    const pageRows = await sql`
      select id
      from pages
      where id = ${pageId}
        and workspace_id = ${workspaceId}
        and is_deleted = false
      limit 1
    `;

    if (pageRows.length === 0) {
      await sql`rollback`;
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    if (tagIds.length > 0) {
      const tagRows = await sql`
        select id
        from tags
        where workspace_id = ${workspaceId}
          and id = any(${tagIds})
      `;

      if (tagRows.length !== tagIds.length) {
        await sql`rollback`;
        return NextResponse.json(
          { ok: false, error: 'Invalid tag selection.' },
          { status: 400 }
        );
      }
    }

    await sql`
      delete from page_tags
      where page_id = ${pageId}
    `;

    for (const tagId of tagIds) {
      await sql`
        insert into page_tags (page_id, tag_id)
        values (${pageId}, ${tagId})
      `;
    }

    await sql`commit`;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    await sql`rollback`;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Database error'
      },
      { status: 500 }
    );
  }
}
