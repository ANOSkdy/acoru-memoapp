import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const colorSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6})$/, 'Invalid color.')
    .nullable()
    .optional()
);

const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  color: colorSchema.optional()
});

const isUniqueViolation = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === '23505';
};

export async function PATCH(
  request: Request,
  { params }: { params: { tagId: string } }
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

  const parsed = updateTagSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, color } = parsed.data;
  if (typeof name === 'undefined' && typeof color === 'undefined') {
    return NextResponse.json(
      { ok: false, error: 'No updates provided.' },
      { status: 400 }
    );
  }

  const tagId = params.tagId;

  try {
    const rows = await sql`
      update tags
      set
        name = coalesce(${name ?? null}, name),
        color = case
          when ${typeof color === 'undefined'} then color
          else ${color ?? null}
        end,
        updated_at = now()
      where id = ${tagId}
        and workspace_id = ${workspaceId}
      returning
        id,
        name,
        color,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    if (rows.length === 0) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    return NextResponse.json({ ok: true, tag: rows[0] }, { status: 200 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: '同じ名前のタグがすでに存在します。'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Database error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { tagId: string } }
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

  const tagId = params.tagId;

  const tagRows = await sql`
    select id
    from tags
    where id = ${tagId}
      and workspace_id = ${workspaceId}
  `;

  if (tagRows.length === 0) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const usageRows = await sql`
    select 1
    from page_tags
    where tag_id = ${tagId}
    limit 1
  `;

  if (usageRows.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'このタグはメモに紐付いているため削除できません。'
      },
      { status: 409 }
    );
  }

  await sql`
    delete from tags
    where id = ${tagId}
      and workspace_id = ${workspaceId}
  `;

  return NextResponse.json({ ok: true }, { status: 200 });
}
