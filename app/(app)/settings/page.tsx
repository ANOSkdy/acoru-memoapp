import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import SettingsClient from './SettingsClient';

export const runtime = 'nodejs';

const getAdminEmails = () =>
  new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

type Preferences = {
  ui: {
    compactMode: boolean;
    reduceMotion: boolean;
  };
  editor: {
    defaultBlockType: 'paragraph' | 'todo';
  };
};

const defaultPreferences: Preferences = {
  ui: {
    compactMode: false,
    reduceMotion: false
  },
  editor: {
    defaultBlockType: 'paragraph' as const
  }
};

export default async function SettingsPage() {
  const user = await requireUser();

  let displayName = user.name;
  let mustChangePassword = false;
  let role: string | null = null;

  if (sql) {
    const rows = await sql`
      select display_name, must_change_password, role
      from users
      where id = ${user.id}
      limit 1;
    `;
    if (rows[0]) {
      displayName = rows[0].display_name ?? displayName;
      mustChangePassword = Boolean(rows[0].must_change_password);
      role = rows[0].role ?? null;
    }
  }

  let preferences = defaultPreferences;
  if (sql) {
    const rows = await sql`
      select preferences
      from user_settings
      where user_id = ${user.id}
      limit 1;
    `;
    const stored = rows[0]?.preferences as
      | {
          ui?: { compactMode?: boolean; reduceMotion?: boolean };
          editor?: { defaultBlockType?: 'paragraph' | 'todo' };
        }
      | undefined;

    if (stored) {
      preferences = {
        ui: {
          compactMode: Boolean(stored.ui?.compactMode),
          reduceMotion: Boolean(stored.ui?.reduceMotion)
        },
        editor: {
          defaultBlockType:
            stored.editor?.defaultBlockType === 'todo' ? 'todo' : 'paragraph'
        }
      };
    }
  }

  const adminEmails = getAdminEmails();
  const isAdmin = adminEmails.has(user.email.toLowerCase()) || role === 'admin';

  return (
    <SettingsClient
      user={{
        email: user.email,
        displayName,
        mustChangePassword
      }}
      preferences={preferences}
      isAdmin={isAdmin}
    />
  );
}
