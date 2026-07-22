import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionContext } from '@/lib/auth';
import { sql } from '@/lib/db';
import {
  extractPlainText,
  flatBlockSchema,
  normalizeBlocks
} from '@/lib/blocks';

export const runtime = 'nodejs';

const requestSchema = z.object({
  baseRevision: z.number().int().min(0),
  title: z.string().trim().min(0).max(200),
  blocks: z.array(flatBlockSchema)
});

type BlockRow = {
  id: string | null;
  pageId: string | null;
  parentBlockId: string | null;
  type: string | null;
  indent: number | null;
  orderIndex: number | null;
  content: unknown;
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

  const { user, workspaceId } = await getSessionContext();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!workspaceId) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const pageId = params.pageId;

  /*
   * One round trip for both the ownership check and the blocks: the left join
   * still yields a row for an accessible page that has no blocks, so an empty
   * page stays a 200 with [] while an inaccessible page stays a 404.
   */
  const rows = (await sql`
    select
      blocks.id,
      blocks.page_id as "pageId",
      blocks.parent_block_id as "parentBlockId",
      blocks.type,
      blocks.indent,
      blocks.order_index as "orderIndex",
      blocks.content
    from pages
    left join blocks on blocks.page_id = pages.id
    where pages.id = ${pageId}
      and pages.workspace_id = ${workspaceId}
      and pages.is_deleted = false
    order by blocks.order_index asc
  `) as BlockRow[];

  if (rows.length === 0) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const blocks = rows[0]?.id === null ? [] : rows;

  return NextResponse.json({ ok: true, blocks }, { status: 200 });
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

  const { user, workspaceId } = await getSessionContext();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

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

  try {
    /*
     * Conflict detection as a single compare-and-swap: the revision guard lives
     * in the WHERE clause, so no separate SELECT ... FOR UPDATE is needed.
     * The neon HTTP driver runs every call as its own transaction, so keeping
     * each step to one statement is what actually makes it atomic.
     */
    const updateRows = await sql`
      update pages
      set
        title = ${title},
        search_text = ${searchText},
        last_opened_at = now(),
        content_revision = content_revision + 1
      where id = ${pageId}
        and workspace_id = ${workspaceId}
        and content_revision = ${baseRevision}
      returning
        content_revision as "contentRevision",
        updated_at as "updatedAt"
    `;

    if (updateRows.length === 0) {
      // Nothing updated: either the page is gone (404) or another writer won (409).
      const currentRows = await sql`
        select content_revision as "contentRevision"
        from pages
        where id = ${pageId}
          and workspace_id = ${workspaceId}
      `;

      if (currentRows.length === 0) {
        return NextResponse.json({ ok: false }, { status: 404 });
      }

      return NextResponse.json(
        { ok: false, serverRevision: currentRows[0]?.contentRevision as number },
        { status: 409 }
      );
    }

    /*
     * Replace the block set in a single HTTP round trip: sql.transaction sends
     * the delete and one multi-row insert as one non-interactive transaction,
     * so the rows are never missing in between and the insert cost no longer
     * grows with the number of blocks.
     */
    if (normalizedBlocks.length === 0) {
      await sql`delete from blocks where page_id = ${pageId}`;
    } else {
      await sql.transaction([
        sql`delete from blocks where page_id = ${pageId}`,
        sql(
          `insert into blocks (
             id,
             page_id,
             parent_block_id,
             type,
             indent,
             order_index,
             content
           )
           select
             block_id,
             $1,
             parent_block_id,
             block_type,
             indent,
             order_index,
             content
           from unnest(
             $2::uuid[],
             $3::uuid[],
             $4::text[],
             $5::smallint[],
             $6::int[],
             $7::jsonb[]
           ) as blocks_input(
             block_id,
             parent_block_id,
             block_type,
             indent,
             order_index,
             content
           )`,
          [
            pageId,
            normalizedBlocks.map((block) => block.id),
            normalizedBlocks.map((block) => block.parentBlockId),
            normalizedBlocks.map((block) => block.type),
            normalizedBlocks.map((block) => block.indent),
            normalizedBlocks.map((block) => block.orderIndex),
            normalizedBlocks.map((block) => JSON.stringify(block.content))
          ]
        )
      ]);
    }

    return NextResponse.json(
      {
        ok: true,
        contentRevision: updateRows[0]?.contentRevision,
        updatedAt: updateRows[0]?.updatedAt
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Database error'
      },
      { status: 500 }
    );
  }
}
