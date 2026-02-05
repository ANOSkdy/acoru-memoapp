import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser } from '@/lib/auth';
import { DEFAULT_PAGE_TITLE, decodePageCursor, listPagesForWorkspace } from '@/lib/pages';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_FOLDER_TITLE = 'Untitled folder';

const childQuerySchema = z.object({
  parentId: z.string().uuid().nullable(),
  kind: z.enum(['page', 'folder']).optional()
});

const createPageSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  kind: z.enum(['page', 'folder']),
  title: z.string().trim().min(1).max(200).optional()
});

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') ?? 'all';

  if (scope === 'children') {
    const parentIdRaw = searchParams.get('parentId');
    const kindRaw = searchParams.get('kind') ?? undefined;
    const parsed = childQuerySchema.safeParse({
      parentId: parentIdRaw ? parentIdRaw : null,
      kind: kindRaw
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { parentId, kind } = parsed.data;

    const rows = kind
      ? await sql`
          select
            id,
            title,
            kind,
            parent_page_id as "parentId",
            position,
            updated_at as "updatedAt"
          from pages
          where workspace_id = ${workspaceId}
            and is_deleted = false
            and parent_page_id is not distinct from ${parentId}
            and kind = ${kind}
          order by position asc, updated_at desc, id asc
        `
      : await sql`
          select
            id,
            title,
            kind,
            parent_page_id as "parentId",
            position,
            updated_at as "updatedAt"
          from pages
          where workspace_id = ${workspaceId}
            and is_deleted = false
            and parent_page_id is not distinct from ${parentId}
          order by position asc, updated_at desc, id asc
        `;

    return NextResponse.json({ ok: true, data: { items: rows } }, { status: 200 });
  }

  if (scope === 'folders') {
    const rows = await sql`
      select
        id,
        title,
        kind,
        parent_page_id as "parentId",
        position,
        updated_at as "updatedAt"
      from pages
      where workspace_id = ${workspaceId}
        and is_deleted = false
        and kind = 'folder'
      order by position asc, updated_at desc, id asc
    `;

    return NextResponse.json({ ok: true, data: { items: rows } }, { status: 200 });
  }

  if (scope !== 'all') {
    return NextResponse.json(
      { ok: false, error: 'Unsupported scope.' },
      { status: 400 }
    );
  }

  const limitParam = searchParams.get('limit');
  const limitRaw = limitParam ? Number(limitParam) : DEFAULT_LIMIT;
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const cursorParam = searchParams.get('cursor');
  const cursor = cursorParam ? decodePageCursor(cursorParam) : null;

  if (cursorParam && !cursor) {
    return NextResponse.json({ ok: false, error: 'Invalid cursor.' }, { status: 400 });
  }

  const data = await listPagesForWorkspace({ workspaceId, limit, cursor });

  return NextResponse.json({ ok: true, data }, { status: 200 });
}

export async function POST(request: Request) {
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

  const parsed = createPageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const parentId = parsed.data.parentId ?? null;
  const kind = parsed.data.kind;
  const title =
    parsed.data.title ??
    (kind === 'folder' ? DEFAULT_FOLDER_TITLE : DEFAULT_PAGE_TITLE);

  if (parentId) {
    const parentRows = await sql`
      select id, kind
      from pages
      where id = ${parentId}
        and workspace_id = ${workspaceId}
        and is_deleted = false
    `;

    if (parentRows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Parent not found.' }, { status: 404 });
    }

    if (parentRows[0]?.kind !== 'folder') {
      return NextResponse.json(
        { ok: false, error: 'Parent must be a folder.' },
        { status: 400 }
      );
    }
  }

  const positionRows = await sql`
    select coalesce(max(position), 0) as max
    from pages
    where workspace_id = ${workspaceId}
      and is_deleted = false
      and parent_page_id is not distinct from ${parentId}
  `;

  const nextPosition = Number(positionRows[0]?.max ?? 0) + 1;

  await sql`begin`;

  try {
    const pageRows = await sql`
      insert into pages (workspace_id, parent_page_id, kind, title, position, last_opened_at)
      values (${workspaceId}, ${parentId}, ${kind}, ${title}, ${nextPosition}, now())
      returning
        id,
        title,
        kind,
        parent_page_id as "parentId",
        position,
        updated_at as "updatedAt"
    `;

    const page = pageRows[0];
    if (!page) {
      throw new Error('Failed to create page.');
    }

    if (kind === 'page') {
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
          gen_random_uuid(),
          ${page.id},
          ${null},
          ${'paragraph'},
          ${0},
          ${0},
          ${JSON.stringify({ text: '' })}
        )
      `;
    }

    await sql`commit`;

    return NextResponse.json({ ok: true, data: { page } }, { status: 201 });
  } catch (error) {
    await sql`rollback`;
    throw error;
  }
}
