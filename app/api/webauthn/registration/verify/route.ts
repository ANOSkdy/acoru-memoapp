import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getSessionTokenFromCookies } from '@/lib/auth/session-token';
import { sql } from '@/lib/db';
import { registrationVerifySchema } from '@/lib/validation/webauthn';
import { getRpConfig } from '@/lib/webauthn/config';

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
  const parsed = registrationVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const challengeRows = await sql`
    select challenge, expires_at
    from webauthn_challenges
    where session_token = ${sessionToken}
      and type = 'registration'
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

  const { rpID, origin } = getRpConfig(request);

  const verification = await verifyRegistrationResponse({
    response: parsed.data.attestationResponse,
    expectedChallenge: challengeRow.challenge as string,
    expectedOrigin: origin,
    expectedRPID: rpID
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'VERIFICATION_FAILED' }, { status: 400 });
  }

  const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;
  const credentialId = isoBase64URL.fromBuffer(credentialID);
  const publicKey = isoBase64URL.fromBuffer(credentialPublicKey);
  const transports = Array.isArray(parsed.data.attestationResponse.response?.transports)
    ? parsed.data.attestationResponse.response.transports
    : null;

  await sql`
    insert into webauthn_credentials (user_id, credential_id, public_key, counter, transports)
    values (${user.id}, ${credentialId}, ${publicKey}, ${counter}, ${transports})
    on conflict (credential_id)
    do update set
      public_key = excluded.public_key,
      counter = excluded.counter,
      transports = excluded.transports;
  `;

  await sql`
    delete from webauthn_challenges
    where session_token = ${sessionToken}
      and type = 'registration';
  `;

  return NextResponse.json({ ok: true });
};
