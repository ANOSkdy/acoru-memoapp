'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { ensureMigrations } from '@/lib/db/migrations';
import {
  createSessionToken,
  getSessionCookieOptions,
  getSessionExpiration,
  hashSessionToken,
  SESSION_COOKIE_NAME
} from '@/lib/auth/session';

type SignInState = {
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signIn = async (
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> => {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  const fieldErrors: SignInState['fieldErrors'] = {};
  if (!email || !emailRegex.test(email)) {
    fieldErrors.email = 'メールアドレスを確認してください。';
  }
  if (!password) {
    fieldErrors.password = 'パスワードを入力してください。';
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  if (!sql) {
    return { error: '現在サインインできません。しばらくしてから再試行してください。' };
  }

  await ensureMigrations();

  const users = await sql`
    select id, email, display_name, password_hash
    from users
    where email = ${email}
    limit 1;
  `;

  if (users.length === 0) {
    return { error: 'メールアドレスまたはパスワードが違います。' };
  }

  const user = users[0];
  const passwordHash = user.password_hash as string | null;
  if (!passwordHash) {
    return { error: 'メールアドレスまたはパスワードが違います。' };
  }

  const isValid = await verifyPassword(password, passwordHash);
  if (!isValid) {
    return { error: 'メールアドレスまたはパスワードが違います。' };
  }

  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = getSessionExpiration();

  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${tokenHash}, ${expiresAt});
  `;

  cookies().set(SESSION_COOKIE_NAME, token, {
    ...getSessionCookieOptions(),
    expires: expiresAt
  });

  redirect('/');
};

export const signOut = async (): Promise<void> => {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token && sql) {
    const tokenHash = hashSessionToken(token);
    await sql`delete from sessions where token_hash = ${tokenHash};`;
  }

  cookieStore.set(SESSION_COOKIE_NAME, '', {
    ...getSessionCookieOptions(),
    maxAge: 0
  });

  redirect('/sign-in');
};

export const createUser = async (
  email: string,
  password: string,
  displayName?: string
) => {
  if (!sql) {
    throw new Error('Database is not configured.');
  }

  await ensureMigrations();

  const passwordHash = await hashPassword(password);
  const name = displayName ?? email.split('@')[0];

  await sql`
    insert into users (email, display_name, password_hash)
    values (${email}, ${name}, ${passwordHash})
    on conflict (email)
    do update set password_hash = ${passwordHash}, display_name = ${name};
  `;
};
