import { NextResponse } from 'next/server';

import { getSessionContext } from '@/lib/auth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
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

  const rows = await sql`
    update pages
    set is_deleted = true,
        deleted_at = now()
    where id = ${pageId}
      and workspace_id = ${workspaceId}
    returning id
  `;

  if (rows.length === 0) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
