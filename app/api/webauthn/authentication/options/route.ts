import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getSessionTokenFromCookies } from '@/lib/auth/session-token';
import { sql } from '@/lib/db';
import { getRpConfig } from '@/lib/webauthn/config';

export const runtime = 'nodejs';

const allowedTransports = new Set<AuthenticatorTransportFuture>([
  'usb',
  'ble',
  'nfc',
  'internal',
  'cable',
  'hybrid',
  'smart-card'
]);

const normalizeTransports = (value: unknown): AuthenticatorTransportFuture[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const filtered = value.filter(
    (item): item is AuthenticatorTransportFuture =>
      typeof item === 'string' && allowedTransports.has(item as AuthenticatorTransportFuture)
  );
  return filtered.length > 0 ? filtered : undefined;
};

export const POST = async (request: Request) => {
  const user = await requireUser();

  if (!sql) {
    return NextResponse.json({ error: 'DB_UNAVAILABLE' }, { status: 500 });
  }

  const sessionToken = getSessionTokenFromCookies();
  if (!sessionToken) {
    return NextResponse.json({ error: 'NO_SESSION' }, { status: 401 });
  }

  const credentials = await sql`
    select credential_id, transports
    from webauthn_credentials
    where user_id = ${user.id};
  `;

  if (credentials.length === 0) {
    return NextResponse.json({ error: 'NO_CREDENTIALS' }, { status: 400 });
  }

  const { rpID } = getRpConfig(request);

  const options = generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((credential) => ({
      id: credential.credential_id as string,
      type: 'public-key',
      transports: normalizeTransports(credential.transports)
    }))
  });

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await sql`
    insert into webauthn_challenges (session_token, type, challenge, user_id, expires_at)
    values (${sessionToken}, 'authentication', ${options.challenge}, ${user.id}, ${expiresAt})
    on conflict (session_token, type)
    do update set
      challenge = excluded.challenge,
      user_id = excluded.user_id,
      expires_at = excluded.expires_at;
  `;

  return NextResponse.json(options);
};
