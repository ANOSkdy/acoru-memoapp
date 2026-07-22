import { requireUser } from '@/lib/auth';
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
  let preferences = defaultPreferences;
  let isAdmin = false;

  if (sql) {
    // Profile, preferences and the admin flag come from one round trip.
    const rows = await sql`
      select
        users.display_name as "displayName",
        users.is_admin as "isAdmin",
        user_settings.preferences as "preferences"
      from users
      left join user_settings on user_settings.user_id = users.id
      where users.id = ${user.id}
      limit 1;
    `;

    const row = rows[0] as
      | {
          displayName: string | null;
          isAdmin: boolean | null;
          preferences: {
            ui?: { compactMode?: boolean; reduceMotion?: boolean };
            editor?: { defaultBlockType?: 'paragraph' | 'todo' };
          } | null;
        }
      | undefined;

    if (row) {
      displayName = row.displayName ?? displayName;
      isAdmin = Boolean(row.isAdmin);

      const stored = row.preferences;
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
  }

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
