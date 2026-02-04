import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  blockSchema,
  blocksSchema,
  buildSearchText,
  normalizeBlocks
} from '@/lib/blocks';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

const pageIdSchema = z.string().uuid();

const updateSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(200),
  blocks: blocksSchema
});

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
    return NextResponse.json(
      { ok: false, error: 'Unauthorized.' },
      { status: 401 }
    );
  }

  const parsedPageId = pageIdSchema.safeParse(params.pageId);
  if (!parsedPageId.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid page id.' },
      { status: 400 }
    );
  }

  const pageRows = await sql`
    select
      id,
      content_revision as "contentRevision"
    from pages
    where id = ${parsedPageId.data}
      and user_id = ${user.id}
    limit 1
  `;

  if (pageRows.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Not found.' },
      { status: 404 }
    );
  }

  const blockRows = await sql`
    select
      type,
      content,
      order_index as "orderIndex"
    from page_blocks
    where page_id = ${parsedPageId.data}
    order by order_index asc
  `;

  const blocks = blockRows.map((row) => {
    const parsed = blockSchema.safeParse({ type: row.type, ...(row.content ?? {}) });
    if (parsed.success) {
      return parsed.data;
    }

    if (row.type === 'divider') {
      return { type: 'divider' };
    }

    return { type: 'paragraph', text: '' };
  });

  return NextResponse.json(
    { ok: true, blocks, contentRevision: pageRows[0].contentRevision },
    { status: 200 }
  );
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
    return NextResponse.json(
      { ok: false, error: 'Unauthorized.' },
      { status: 401 }
    );
  }

  const parsedPageId = pageIdSchema.safeParse(params.pageId);
  if (!parsedPageId.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid page id.' },
      { status: 400 }
    );
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

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { baseRevision, title, blocks } = parsed.data;

  const normalizedBlocks = normalizeBlocks(blocks);
  const searchText = buildSearchText(title, normalizedBlocks);

  const types = normalizedBlocks.map((block) => block.type);
  const contents = normalizedBlocks.map((block) => block.content);
  const orderIndexes = normalizedBlocks.map((_block, index) => index);

  const updatedRows = await sql`
    with updated as (
      update pages
      set
        title = ${title},
        search_text = ${searchText},
        last_opened_at = now(),
        updated_at = now(),
        content_revision = content_revision + 1
      where id = ${parsedPageId.data}
        and user_id = ${user.id}
        and content_revision = ${baseRevision}
      returning id, content_revision
    ),
    deleted as (
      delete from page_blocks
      where page_id in (select id from updated)
    ),
    inserted as (
      insert into page_blocks (page_id, type, content, order_index)
      select updated.id, block_values.type, block_values.content, block_values.order_index
      from updated
      join unnest(
        ${types}::text[],
        ${contents}::jsonb[],
        ${orderIndexes}::int[]
      ) as block_values(type, content, order_index)
      on true
    )
    select content_revision as "contentRevision" from updated;
  `;

  if (updatedRows.length === 0) {
    const revisionRows = await sql`
      select content_revision as "contentRevision"
      from pages
      where id = ${parsedPageId.data}
        and user_id = ${user.id}
      limit 1
    `;

    if (revisionRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'Conflict.', serverRevision: revisionRows[0].contentRevision },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { ok: true, contentRevision: updatedRows[0].contentRevision },
    { status: 200 }
  );
}
