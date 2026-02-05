import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getSessionTokenFromCookies } from '@/lib/auth/session-token';
import { sql } from '@/lib/db';
import { authenticationVerifySchema } from '@/lib/validation/webauthn';
import { getRpConfig } from '@/lib/webauthn/config';
import { toAuthenticatorTransports } from '@/lib/webauthn/transports';

export const runtime = 'nodejs';

export const POST = async (request: Request) => {
  const user = await requireUser();

  if (!sql) {
    return NextResponse.json({ error: 'DB_UNAVAILABLE' }, { status: 500 });
  }

  const sessionToken = getSessionTokenFromCookies();
  if (!sessionToken) {
    return NextResponse.json({ error: 'NO_SESSION' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = authenticationVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const challengeRows = await sql`
    select challenge, expires_at
    from webauthn_challenges
    where session_token = ${sessionToken}
      and type = 'authentication'
      and user_id = ${user.id}
    limit 1;
  `;

  const challengeRow = challengeRows[0];
  if (!challengeRow) {
    return NextResponse.json({ error: 'CHALLENGE_EXPIRED' }, { status: 400 });
  }

  const expiresAt = new Date(challengeRow.expires_at as string);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'CHALLENGE_EXPIRED' }, { status: 400 });
  }

  const credentialId = parsed.data.assertionResponse.id as string | undefined;
  if (!credentialId) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const credentialRows = await sql`
    select credential_id, public_key, counter, transports
    from webauthn_credentials
    where user_id = ${user.id}
      and credential_id = ${credentialId}
    limit 1;
  `;

  const credential = credentialRows[0];
  if (!credential) {
    return NextResponse.json({ error: 'CREDENTIAL_NOT_FOUND' }, { status: 400 });
  }

  const { rpID, origin } = getRpConfig(request);

  const verification = await verifyAuthenticationResponse({
    response: parsed.data.assertionResponse,
    expectedChallenge: challengeRow.challenge as string,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      credentialID: isoBase64URL.toBuffer(credential.credential_id as string),
      credentialPublicKey: isoBase64URL.toBuffer(credential.public_key as string),
      counter: Number(credential.counter ?? 0),
      transports: toAuthenticatorTransports(credential.transports)
    }
  });

  if (!verification.verified || !verification.authenticationInfo) {
    return NextResponse.json({ error: 'VERIFICATION_FAILED' }, { status: 400 });
  }

  await sql`
    update webauthn_credentials
    set counter = ${verification.authenticationInfo.newCounter}
    where credential_id = ${credential.credential_id as string};
  `;

  await sql`
    insert into webauthn_stepups (session_token, verified_at)
    values (${sessionToken}, now())
    on conflict (session_token)
    do update set verified_at = excluded.verified_at;
  `;

  await sql`
    delete from webauthn_challenges
    where session_token = ${sessionToken}
      and type = 'authentication';
  `;

  return NextResponse.json({ ok: true });
};
