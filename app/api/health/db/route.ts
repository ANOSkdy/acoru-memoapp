import { NextResponse } from 'next/server';

import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  if (!sql) {
    return NextResponse.json({ ok: true, db: false }, { status: 200 });
  }

  try {
    await sql`select 1 as ok`;
    return NextResponse.json({ ok: true, db: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        db: false,
        error: error instanceof Error ? error.message : 'Database error'
      },
      { status: 500 }
    );
  }
}
