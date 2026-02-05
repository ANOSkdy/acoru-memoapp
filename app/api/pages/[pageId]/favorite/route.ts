import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const requestSchema = z.object({
  isFavorite: z.boolean()
});

export async function POST(
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
  const { isFavorite } = parsed.data;

  const rows = await sql`
    update pages
    set
      is_favorite = ${isFavorite},
      updated_at = now()
    where id = ${pageId}
      and workspace_id = ${workspaceId}
      and is_deleted = false
    returning id
  `;

  if (rows.length === 0) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
