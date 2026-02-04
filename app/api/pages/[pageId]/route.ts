import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

const pageIdSchema = z.string().uuid();

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

  const rows = await sql`
    select
      id,
      title,
      content_revision as "contentRevision"
    from pages
    where id = ${parsedPageId.data}
      and user_id = ${user.id}
    limit 1
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Not found.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, page: rows[0] }, { status: 200 });
}
