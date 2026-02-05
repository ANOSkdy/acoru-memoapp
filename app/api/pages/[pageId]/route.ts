import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

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

  const rows = await sql`
    update pages
    set last_opened_at = now()
    where id = ${pageId}
      and workspace_id = ${workspaceId}
      and is_deleted = false
    returning
      id,
      title,
      content_revision as "contentRevision",
      updated_at as "updatedAt",
      is_favorite as "isFavorite"
  `;

  if (rows.length === 0) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true, page: rows[0] }, { status: 200 });
}

export async function DELETE(
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

  const result = await sql`
    delete from pages
    where id = ${pageId}
      and workspace_id = ${workspaceId}
    returning id
  `;

  if (result.length === 0) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
