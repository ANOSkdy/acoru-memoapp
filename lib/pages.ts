import 'server-only';

import { notFound, redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const DEFAULT_PAGE_TITLE = 'Untitled';

type PageCursor = {
  updatedAt: string;
  id: string;
};

export type PageListItem = {
  id: string;
  title: string | null;
  updatedAt: string | Date;
};

const encodePageCursor = (cursor: PageCursor) => {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
};

export const decodePageCursor = (cursor: string): PageCursor | null => {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf-8')
    ) as Partial<PageCursor>;
    if (typeof parsed.updatedAt !== 'string' || typeof parsed.id !== 'string') {
      return null;
    }
    return { updatedAt: parsed.updatedAt, id: parsed.id };
  } catch {
    return null;
  }
};

export const createNewPage = async () => {
  'use server';

  if (!sql) {
    throw new Error('Database not configured.');
  }

  const user = await requireUser();
  const workspaceId = await getWorkspaceIdForUser(user.id);

  if (!workspaceId) {
    notFound();
  }

  let pageId: string | undefined;

  await sql`begin`;

  try {
    const pageRows = await sql`
      insert into pages (workspace_id, title, last_opened_at)
      values (${workspaceId}, ${DEFAULT_PAGE_TITLE}, now())
      returning id
    `;

    pageId = pageRows[0]?.id as string | undefined;

    if (!pageId) {
      throw new Error('Failed to create page.');
    }

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
        ${pageId},
        ${null},
        ${'paragraph'},
        ${0},
        ${0},
        ${JSON.stringify({ text: '' })}
      )
    `;

    await sql`commit`;
  } catch (error) {
    await sql`rollback`;
    throw error;
  }

  redirect(`/p/${pageId}`);
};

export const listPagesForWorkspace = async ({
  workspaceId,
  limit,
  cursor
}: {
  workspaceId: string;
  limit: number;
  cursor?: PageCursor | null;
}): Promise<{ items: PageListItem[]; nextCursor: string | null }> => {
  if (!sql) {
    throw new Error('Database not configured.');
  }

  const rows = cursor
    ? await sql`
        select id, title, updated_at as "updatedAt"
        from pages
        where workspace_id = ${workspaceId}
          and is_deleted = false
          and (updated_at, id) < (${cursor.updatedAt}::timestamptz, ${cursor.id})
        order by updated_at desc, id desc
        limit ${limit}
      `
    : await sql`
        select id, title, updated_at as "updatedAt"
        from pages
        where workspace_id = ${workspaceId}
          and is_deleted = false
        order by updated_at desc, id desc
        limit ${limit}
      `;

  const items = rows as PageListItem[];
  const lastItem = items[items.length - 1];
  const nextCursor =
    items.length === limit && lastItem
      ? encodePageCursor({
          updatedAt:
            typeof lastItem.updatedAt === 'string'
              ? lastItem.updatedAt
              : new Date(lastItem.updatedAt).toISOString(),
          id: lastItem.id
        })
      : null;

  return { items, nextCursor };
};
