import 'server-only';

import { getSessionTokenFromCookies } from '@/lib/auth/session-token';
import { sql } from '@/lib/db';

export const STEP_UP_WINDOW_MINUTES = 10;

export const isStepUpVerified = async (): Promise<boolean> => {
  if (!sql) {
    return false;
  }

  const sessionToken = getSessionTokenFromCookies();
  if (!sessionToken) {
    return false;
  }

  const cutoff = new Date(Date.now() - STEP_UP_WINDOW_MINUTES * 60 * 1000);

  const rows = await sql`
    select session_token
    from webauthn_stepups
    where session_token = ${sessionToken}
      and verified_at > ${cutoff}
    limit 1;
  `;

  return rows.length > 0;
};
