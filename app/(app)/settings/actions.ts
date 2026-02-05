'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { isAdminUser, requireUser } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { sql } from '@/lib/db';
import {
  adminCreateUserSchema,
  changePasswordSchema,
  preferencesSchema,
  profileSchema
} from '@/lib/validation/settings';

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  tempPassword?: string;
};

const parseFieldErrors = (issues: { path: (string | number)[]; message: string }[]) => {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
};

const ensureAdmin = async (userId: string) => isAdminUser(userId);

export const updateProfile = async (
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> => {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    displayName: String(formData.get('displayName') ?? '').trim()
  });

  if (!parsed.success) {
    return { fieldErrors: parseFieldErrors(parsed.error.issues) };
  }

  if (!sql) {
    return { error: '現在設定を更新できません。' };
  }

  await sql`
    update users
    set display_name = ${parsed.data.displayName}
    where id = ${user.id};
  `;

  revalidatePath('/settings');

  return { ok: true };
};

export const changePassword = async (
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> => {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get('currentPassword') ?? ''),
    newPassword: String(formData.get('newPassword') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? '')
  });

  if (!parsed.success) {
    return { fieldErrors: parseFieldErrors(parsed.error.issues) };
  }

  if (!sql) {
    return { error: '現在パスワードを更新できません。' };
  }

  const rows = await sql`
    select password_hash
    from users
    where id = ${user.id}
    limit 1;
  `;

  const passwordHash = rows[0]?.password_hash as string | undefined;
  if (!passwordHash) {
    return { error: 'ユーザー情報を取得できませんでした。' };
  }

  const isValid = await verifyPassword(parsed.data.currentPassword, passwordHash);
  if (!isValid) {
    return { fieldErrors: { currentPassword: '現在のパスワードが違います。' } };
  }

  const newHash = await hashPassword(parsed.data.newPassword);

  await sql`
    update users
    set password_hash = ${newHash},
        must_change_password = false
    where id = ${user.id};
  `;

  revalidatePath('/settings');

  return { ok: true };
};

export const updatePreferences = async (
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> => {
  const user = await requireUser();

  const parsed = preferencesSchema.safeParse({
    compactMode: Boolean(formData.get('compactMode')),
    reduceMotion: Boolean(formData.get('reduceMotion')),
    defaultBlockType: String(formData.get('defaultBlockType') ?? 'paragraph')
  });

  if (!parsed.success) {
    return { fieldErrors: parseFieldErrors(parsed.error.issues) };
  }

  if (!sql) {
    return { error: '現在設定を更新できません。' };
  }

  const preferences = {
    ui: {
      compactMode: parsed.data.compactMode,
      reduceMotion: parsed.data.reduceMotion
    },
    editor: {
      defaultBlockType: parsed.data.defaultBlockType
    }
  };

  await sql`
    insert into user_settings (user_id, preferences, updated_at)
    values (${user.id}, ${JSON.stringify(preferences)}::jsonb, now())
    on conflict (user_id)
    do update set preferences = ${JSON.stringify(preferences)}::jsonb, updated_at = now();
  `;

  revalidatePath('/settings');

  return { ok: true };
};

export const adminCreateUser = async (
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> => {
  const user = await requireUser();

  const isAdmin = await ensureAdmin(user.id);
  if (!isAdmin) {
    return { error: '管理者のみ利用できます。' };
  }

  const parsed = adminCreateUserSchema.safeParse({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    name: String(formData.get('name') ?? '').trim() || undefined,
    role: String(formData.get('role') ?? 'user'),
    mustChangePassword: Boolean(formData.get('mustChangePassword'))
  });

  if (!parsed.success) {
    return { fieldErrors: parseFieldErrors(parsed.error.issues) };
  }

  if (!sql) {
    return { error: '現在ユーザーを作成できません。' };
  }

  const tempPassword = randomBytes(16).toString('base64url');
  const passwordHash = await hashPassword(tempPassword);
  const displayName = parsed.data.name || parsed.data.email.split('@')[0] || 'User';

  const isAdminRole = parsed.data.role === 'admin';
  const rows = await sql`
    insert into users (email, display_name, password_hash, role, is_admin, must_change_password)
    values (
      ${parsed.data.email},
      ${displayName},
      ${passwordHash},
      ${parsed.data.role},
      ${isAdminRole},
      ${parsed.data.mustChangePassword}
    )
    on conflict (email)
    do nothing
    returning id;
  `;

  const userId = rows[0]?.id as string | undefined;
  if (!userId) {
    return { fieldErrors: { email: 'このメールアドレスは既に使われています。' } };
  }

  await sql`
    insert into workspaces (owner_user_id)
    values (${userId})
    on conflict (owner_user_id)
    do update set owner_user_id = excluded.owner_user_id;
  `;

  revalidatePath('/settings');

  return { ok: true, tempPassword };
};
