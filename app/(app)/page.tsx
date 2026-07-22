import { notFound } from 'next/navigation';

import { requireSessionContext } from '@/lib/auth';
import { sql } from '@/lib/db';
import NotesGrid, { type MemoRow } from './notes/notes-grid';

export const runtime = 'nodejs';

/** Upper bound for the initial server-rendered page list. */
const INITIAL_MEMO_LIMIT = 500;

export default async function HomePage() {
  const { workspaceId } = await requireSessionContext();

  if (!workspaceId) {
    notFound();
  }

  if (!sql) {
    throw new Error('Database not configured.');
  }

  const rows = await sql`
    select
      id,
      title,
      updated_at as "updatedAt"
    from pages
    where workspace_id = ${workspaceId}
      and is_deleted = false
      and kind = 'page'
    order by updated_at desc, id desc
    limit ${INITIAL_MEMO_LIMIT}
  `;

  const initialItems = (rows as MemoRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : row.updatedAt
  }));

  return (
    <div className="home">
      <div className="home-header">
        <div>
          <div className="badge">Notes</div>
          <h1>メモ一覧</h1>
          <p className="home-subtitle">
            すべてのメモを一覧で表示します。行を選択すると編集画面が開きます。
          </p>
        </div>
      </div>
      <NotesGrid initialItems={initialItems} />
    </div>
  );
}
