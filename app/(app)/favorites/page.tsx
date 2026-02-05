import { notFound } from 'next/navigation';

import NotesList from '../notes/notes-list';
import { requireUser } from '@/lib/auth';
import { createNewPage, listFavoritePagesForWorkspace } from '@/lib/pages';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

export default async function FavoritesPage() {
  const user = await requireUser();
  const workspaceId = await getWorkspaceIdForUser(user.id);

  if (!workspaceId) {
    notFound();
  }

  const items = await listFavoritePagesForWorkspace({ workspaceId });

  return (
    <div className="home">
      <div className="home-header">
        <div>
          <div className="badge">Favorites</div>
          <h1>お気に入り</h1>
          <p className="home-subtitle">
            お気に入りに登録したメモを一覧で表示します。
          </p>
        </div>
        <form action={createNewPage}>
          <button className="button" type="submit">
            新規メモ
          </button>
        </form>
      </div>

      <section className="home-section">
        <h2 className="home-section__title">お気に入り</h2>
        {items.length === 0 ? (
          <div className="card home-empty">
            <p>お気に入りはまだありません。新規メモを作成しましょう。</p>
            <form action={createNewPage}>
              <button className="button" type="submit">
                New note
              </button>
            </form>
          </div>
        ) : (
          <NotesList items={items} showTrash={false} />
        )}
      </section>
    </div>
  );
}
