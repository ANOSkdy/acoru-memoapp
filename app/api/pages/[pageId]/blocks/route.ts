import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import {
  extractPlainText,
  flatBlockSchema,
  normalizeBlocks
} from '@/lib/blocks';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const requestSchema = z.object({
  baseRevision: z.number().int().min(0),
  title: z.string().trim().min(0).max(200),
  blocks: z.array(flatBlockSchema)
});

const ensureWorkspaceAccess = async (pageId: string, workspaceId: string) => {
  const rows = await sql`
    select id
    from pages
    where id = ${pageId}
      and workspace_id = ${workspaceId}
    limit 1
  `;

  return rows.length > 0;
};

export async function GET(
  _request: Request,
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

  const pageId = params.pageId;
  const hasAccess = await ensureWorkspaceAccess(pageId, workspaceId);

  if (!hasAccess) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const rows = await sql`
    select
      id,
      page_id as "pageId",
      parent_block_id as "parentBlockId",
      type,
      indent,
      order_index as "orderIndex",
      content
    from blocks
    where page_id = ${pageId}
    order by order_index asc
  `;

  return NextResponse.json({ ok: true, blocks: rows }, { status: 200 });
}

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

  const { baseRevision, title, blocks } = parsed.data;
  const pageId = params.pageId;

  const normalizedBlocks = normalizeBlocks(
    blocks.map((block) => ({
      ...block,
      pageId
    }))
  );

  const searchText = extractPlainText(normalizedBlocks);

  await sql`begin`;

  try {
    const revisionRows = await sql`
      select content_revision as "contentRevision"
      from pages
      where id = ${pageId}
        and workspace_id = ${workspaceId}
      for update
    `;

    if (revisionRows.length === 0) {
      await sql`rollback`;
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const serverRevision = revisionRows[0]?.contentRevision as number;

    if (serverRevision !== baseRevision) {
      await sql`rollback`;
      return NextResponse.json(
        { ok: false, serverRevision },
        { status: 409 }
      );
    }

    const updateRows = await sql`
      update pages
      set
        title = ${title},
        search_text = ${searchText},
        last_opened_at = now(),
        content_revision = content_revision + 1
      where id = ${pageId}
        and workspace_id = ${workspaceId}
      returning
        content_revision as "contentRevision",
        updated_at as "updatedAt"
    `;

    await sql`
      delete from blocks
      where page_id = ${pageId}
    `;

    for (const block of normalizedBlocks) {
      await sql`
        insert into blocks (
          id,
          page_id,
          parent_block_id,
          type,
          indent,
          order_index,
          content
        )
        values (
          ${block.id},
          ${pageId},
          ${block.parentBlockId},
          ${block.type},
          ${block.indent},
          ${block.orderIndex},
          ${JSON.stringify(block.content)}
        )
      `;
    }

    await sql`commit`;

    return NextResponse.json(
      {
        ok: true,
        contentRevision: updateRows[0]?.contentRevision,
        updatedAt: updateRows[0]?.updatedAt
      },
      { status: 200 }
    );
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
