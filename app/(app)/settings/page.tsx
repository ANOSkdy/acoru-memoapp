import { isAdminUser, requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import SettingsClient from './SettingsClient';

export const runtime = 'nodejs';

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

  if (sql) {
    const rows = await sql`
      select display_name
      from users
      where id = ${user.id}
      limit 1;
    `;
    if (rows[0]) {
      displayName = rows[0].display_name ?? displayName;
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

  const isAdmin = await isAdminUser(user.id);

  return (
    <SettingsClient
      user={{
        email: user.email,
        displayName
      }}
      preferences={preferences}
      isAdmin={isAdmin}
    />
  );
}
