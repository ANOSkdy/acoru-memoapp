import { notFound } from 'next/navigation';

import NotesHierarchy from './notes-hierarchy';
import { requireUser } from '@/lib/auth';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

export default async function NotesPage() {
  const user = await requireUser();
  const workspaceId = await getWorkspaceIdForUser(user.id);

  if (!workspaceId) {
    notFound();
  }

  return (
    <div className="home">
      <div className="home-header">
        <div>
          <div className="badge">All notes</div>
          <h1>メモ一覧</h1>
          <p className="home-subtitle">
            フォルダツリーと配下メモをまとめて管理できます。
          </p>
        </div>
      </div>

      <NotesHierarchy />
    </div>
  );
}
