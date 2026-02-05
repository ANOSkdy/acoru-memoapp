import { notFound } from 'next/navigation';

import TrashList from './trash-list';
import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const formatTimestamp = (value: string | Date | null) => {
  if (!value) {
    return 'Not available';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

type TrashItem = {
  id: string;
  title: string | null;
  deletedAt: string | Date | null;
  updatedAt: string | Date | null;
};

export default async function TrashPage() {
  if (!sql) {
    throw new Error('Database not configured.');
  }

  const user = await requireUser();
  const workspaceId = await getWorkspaceIdForUser(user.id);

  if (!workspaceId) {
    notFound();
  }

  const rows = await sql`
    select
      id,
      title,
      deleted_at as "deletedAt",
      updated_at as "updatedAt"
    from pages
    where workspace_id = ${workspaceId}
      and is_deleted = true
    order by deleted_at desc nulls last, updated_at desc
  `;

  const items = rows as TrashItem[];

  return (
    <div className="home">
      <div className="home-header">
        <div>
          <div className="badge">Trash</div>
          <h1>ゴミ箱</h1>
          <p className="home-subtitle">
            削除したメモを復元するか、完全削除できます。
          </p>
        </div>
      </div>

      <section className="home-section">
        <h2 className="home-section__title">削除済みメモ</h2>
        {items.length === 0 ? (
          <div className="card home-empty">
            <p>ゴミ箱は空です。</p>
          </div>
        ) : (
          <TrashList
            items={items.map((item) => ({
              ...item,
              deletedLabel: formatTimestamp(item.deletedAt),
              updatedLabel: formatTimestamp(item.updatedAt)
            }))}
          />
        )}
      </section>
    </div>
  );
}
