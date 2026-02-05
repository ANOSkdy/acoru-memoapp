import Link from 'next/link';
import { notFound } from 'next/navigation';

import NotesList from './notes-list';
import { requireUser } from '@/lib/auth';
import {
  createNewPage,
  decodePageCursor,
  listPagesForWorkspace
} from '@/lib/pages';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 20;

type NotesPageProps = {
  searchParams?: { cursor?: string };
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const user = await requireUser();
  const workspaceId = await getWorkspaceIdForUser(user.id);

  if (!workspaceId) {
    notFound();
  }

  const cursor = searchParams?.cursor
    ? decodePageCursor(searchParams.cursor)
    : null;

  const { items, nextCursor } = await listPagesForWorkspace({
    workspaceId,
    limit: DEFAULT_LIMIT,
    cursor
  });

  return (
    <div className="home">
      <div className="home-header">
        <div>
          <div className="badge">All notes</div>
          <h1>メモ一覧</h1>
          <p className="home-subtitle">ワークスペース内のメモを更新順で表示します。</p>
        </div>
        <form action={createNewPage}>
          <button className="button" type="submit">
            新規メモ
          </button>
        </form>
      </div>

      <section className="home-section">
        <h2 className="home-section__title">すべてのメモ</h2>
        {items.length === 0 ? (
          <div className="card home-empty">
            <p>まだメモがありません。新規メモを作成しましょう。</p>
            <form action={createNewPage}>
              <button className="button" type="submit">
                New note
              </button>
            </form>
          </div>
        ) : (
          <NotesList items={items} />
        )}
      </section>

      {nextCursor && (
        <div>
          <Link
            className="button button--ghost"
            href={`/notes?cursor=${encodeURIComponent(nextCursor)}`}
          >
            さらに読み込む
          </Link>
        </div>
      )}
    </div>
  );
}
