import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const querySchema = z.object({
  q: z.string().trim().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional()
});

const buildSnippet = (text: string, query: string) => {
  if (!text) {
    return '';
  }
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) {
    return text.slice(0, 120);
  }
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + query.length + 60);
  const snippet = text.slice(start, end);
  return start > 0 ? `…${snippet}` : snippet;
};

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
  const q = searchParams.get('q') ?? '';
  const limitParam = searchParams.get('limit') ?? undefined;

  const parsed = querySchema.safeParse({ q, limit: limitParam });
  if (!parsed.success) {
    if (q.trim().length < 2) {
      return NextResponse.json({ ok: true, data: { items: [] } }, { status: 200 });
    }
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { q: query, limit = 20 } = parsed.data;
  const likeQuery = `%${query}%`;

  const rows = await sql`
    select
      id,
      title,
      search_text as "searchText",
      updated_at as "updatedAt"
    from pages
    where workspace_id = ${workspaceId}
      and is_deleted = false
      and kind = 'page'
      and (
        title ilike ${likeQuery}
        or search_text ilike ${likeQuery}
      )
    order by updated_at desc, id desc
    limit ${limit}
  `;

  const items = rows.map((row) => ({
    id: row.id as string,
    title: row.title as string | null,
    updatedAt: row.updatedAt as string,
    snippet: buildSnippet(String(row.searchText ?? ''), query)
  }));

  return NextResponse.json({ ok: true, data: { items } }, { status: 200 });
}
