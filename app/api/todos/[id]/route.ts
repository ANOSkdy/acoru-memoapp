import { NextResponse } from 'next/server';
import { z } from 'zod';

import { sql } from '@/lib/db';

export const runtime = 'nodejs';

const idSchema = z.coerce.number().int().positive();

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    isDone: z.boolean().optional()
  })
  .refine((data) => data.title !== undefined || data.isDone !== undefined, {
    message: 'At least one field must be provided.'
  });

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!sql) {
    return NextResponse.json(
      { ok: false, error: 'Database not configured.' },
      { status: 503 }
    );
  }

  const parsedId = idSchema.safeParse(params.id);
  if (!parsedId.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid id.' },
      { status: 400 }
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

  const parsedBody = updateSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, error: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  const { title, isDone } = parsedBody.data;
  const id = parsedId.data;

  try {
    let rows: Array<{
      id: number;
      title: string;
      isDone: boolean;
      createdAt: string;
    }> = [];

    if (title !== undefined && isDone !== undefined) {
      rows = await sql`
        update todos
        set title = ${title}, is_done = ${isDone}
        where id = ${id}
        returning
          id,
          title,
          is_done as "isDone",
          created_at as "createdAt"
      `;
    } else if (title !== undefined) {
      rows = await sql`
        update todos
        set title = ${title}
        where id = ${id}
        returning
          id,
          title,
          is_done as "isDone",
          created_at as "createdAt"
      `;
    } else if (isDone !== undefined) {
      rows = await sql`
        update todos
        set is_done = ${isDone}
        where id = ${id}
        returning
          id,
          title,
          is_done as "isDone",
          created_at as "createdAt"
      `;
    }

    const todo = rows[0];
    if (!todo) {
      return NextResponse.json(
        { ok: false, error: 'Todo not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, todo }, { status: 200 });
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

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!sql) {
    return NextResponse.json(
      { ok: false, error: 'Database not configured.' },
      { status: 503 }
    );
  }

  const parsedId = idSchema.safeParse(params.id);
  if (!parsedId.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid id.' },
      { status: 400 }
    );
  }

  try {
    const rows = await sql`
      delete from todos
      where id = ${parsedId.data}
      returning id
    `;

    if (!rows[0]) {
      return NextResponse.json(
        { ok: false, error: 'Todo not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
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
