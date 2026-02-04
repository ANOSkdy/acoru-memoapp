import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

import { hashPassword } from '@/lib/auth/password';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;
const MAX_NAME_LENGTH = 120;

const unauthorizedResponse = () =>
  NextResponse.json({ ok: false }, { status: 403 });

export async function POST(request: Request) {
  const bootstrapToken = process.env.BOOTSTRAP_TOKEN?.trim();
  if (!bootstrapToken) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_BOOTSTRAP_IN_PROD !== '1') {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const providedToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  const expectedBuffer = Buffer.from(bootstrapToken);
  const providedBuffer = Buffer.from(providedToken);
  const hasValidToken =
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);

  if (!hasValidToken) {
    return unauthorizedResponse();
  }

  if (!sql) {
    return NextResponse.json({ ok: false, error: 'Database is not configured.' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const { email, password, name, displayName } = body as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
    displayName?: unknown;
  };

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (
    !normalizedEmail ||
    normalizedEmail.length > MAX_EMAIL_LENGTH ||
    !emailRegex.test(normalizedEmail)
  ) {
    return NextResponse.json({ ok: false, error: 'Invalid email address.' }, { status: 400 });
  }

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ ok: false, error: 'Invalid password length.' }, { status: 400 });
  }

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
  const localPart = normalizedEmail.split('@')[0] ?? '';
  const resolvedDisplayName = trimmedDisplayName || trimmedName || localPart;
  const resolvedName = trimmedName || resolvedDisplayName;

  if (!resolvedDisplayName) {
    return NextResponse.json({ ok: false, error: 'Display name is required.' }, { status: 400 });
  }

  if (resolvedDisplayName.length > MAX_NAME_LENGTH || resolvedName.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ ok: false, error: 'Name is too long.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  const userRows = await sql`
    insert into users (email, name, display_name, password_hash)
    values (${normalizedEmail}, ${resolvedName}, ${resolvedDisplayName}, ${passwordHash})
    on conflict (email)
    do update set
      name = excluded.name,
      display_name = excluded.display_name,
      password_hash = excluded.password_hash
    returning id;
  `;

  const userId = userRows[0]?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Failed to upsert user.' }, { status: 500 });
  }

  const workspaceRows = await sql`
    insert into workspaces (owner_user_id)
    values (${userId})
    on conflict (owner_user_id)
    do update set owner_user_id = excluded.owner_user_id
    returning id;
  `;

  const workspaceId = workspaceRows[0]?.id as string | undefined;
  if (!workspaceId) {
    return NextResponse.json({ ok: false, error: 'Failed to ensure workspace.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId, workspaceId }, { status: 200 });
}
