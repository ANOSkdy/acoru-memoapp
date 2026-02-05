import { z } from 'zod';

const displayNameSchema = z
  .string()
  .trim()
  .min(1, '表示名を入力してください。')
  .max(120, '表示名は120文字以内で入力してください。');

export const profileSchema = z.object({
  displayName: displayNameSchema
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '現在のパスワードを入力してください。'),
    newPassword: z
      .string()
      .min(8, '新しいパスワードは8文字以上で入力してください。')
      .max(256, '新しいパスワードは256文字以内で入力してください。'),
    confirmPassword: z.string().min(1, '確認用パスワードを入力してください。')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '新しいパスワードが一致しません。',
    path: ['confirmPassword']
  });

export const preferencesSchema = z.object({
  compactMode: z.boolean(),
  reduceMotion: z.boolean(),
  defaultBlockType: z.enum(['paragraph', 'todo'])
});

export const adminCreateUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'メールアドレスを入力してください。')
    .email('メールアドレスを確認してください。')
    .max(320, 'メールアドレスが長すぎます。'),
  name: z
    .string()
    .trim()
    .max(120, '名前は120文字以内で入力してください。')
    .optional(),
  isAdmin: z.boolean().default(false)
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;
