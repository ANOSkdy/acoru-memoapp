import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth';
import { decodePageCursor, listPagesForWorkspace } from '@/lib/pages';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

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

  if (scope !== 'all') {
    return NextResponse.json({ ok: false, error: 'Unsupported scope.' }, { status: 400 });
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
