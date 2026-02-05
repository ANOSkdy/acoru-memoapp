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

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: colorSchema
});

const isUniqueViolation = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === '23505';
};

export async function GET() {
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

  const rows = await sql`
    select
      id,
      name,
      color,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from tags
    where workspace_id = ${workspaceId}
    order by lower(name) asc
  `;

  return NextResponse.json({ ok: true, tags: rows }, { status: 200 });
}

export async function POST(request: Request) {
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

  const parsed = createTagSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, color } = parsed.data;

  try {
    const rows = await sql`
      insert into tags (workspace_id, name, color)
      values (${workspaceId}, ${name}, ${color ?? null})
      returning
        id,
        name,
        color,
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    return NextResponse.json({ ok: true, tag: rows[0] }, { status: 201 });
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
