import { NextResponse } from 'next/server';
import { z } from 'zod';

import { sql } from '@/lib/db';

export const runtime = 'nodejs';

const todoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  isDone: z.boolean().optional()
});

const limitSchema = z.coerce.number().int().min(1).max(100).optional();

export async function GET(request: Request) {
  if (!sql) {
    return NextResponse.json(
      { ok: false, error: 'Database not configured.' },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const parsedLimit = limitSchema.safeParse(url.searchParams.get('limit') ?? undefined);

  if (!parsedLimit.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid limit.' },
      { status: 400 }
    );
  }

  const limit = parsedLimit.data ?? 20;

  try {
    const rows = await sql`
      select
        id,
        title,
        is_done as "isDone",
        created_at as "createdAt"
      from todos
      order by created_at desc
      limit ${limit}
    `;

    return NextResponse.json({ ok: true, todos: rows }, { status: 200 });
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

export async function POST(request: Request) {
  if (!sql) {
    return NextResponse.json(
      { ok: false, error: 'Database not configured.' },
      { status: 503 }
    );
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

  const parsed = todoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, isDone } = parsed.data;

  try {
    const rows = await sql`
      insert into todos (title, is_done)
      values (${title}, ${isDone ?? false})
      returning
        id,
        title,
        is_done as "isDone",
        created_at as "createdAt"
    `;

    return NextResponse.json({ ok: true, todo: rows[0] }, { status: 201 });
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
