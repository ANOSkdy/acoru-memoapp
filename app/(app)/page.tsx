import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getWorkspaceIdForUser } from '@/lib/workspaces';

export const runtime = 'nodejs';

const DEFAULT_TITLE = 'Untitled';

const formatUpdatedAt = (value: string | Date | null) => {
  if (!value) {
    return 'Not edited yet';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const createNewPage = async () => {
  'use server';

  if (!sql) {
    throw new Error('Database not configured.');
  }

  const user = await requireUser();
  const workspaceId = await getWorkspaceIdForUser(user.id);

  if (!workspaceId) {
    notFound();
  }

  let pageId: string | undefined;

  await sql`begin`;

  try {
    const pageRows = await sql`
      insert into pages (workspace_id, title, last_opened_at)
      values (${workspaceId}, ${DEFAULT_TITLE}, now())
      returning id
    `;

    pageId = pageRows[0]?.id as string | undefined;

    if (!pageId) {
      throw new Error('Failed to create page.');
    }

    await sql`
      insert into blocks (
        id,
        page_id,
        parent_block_id,
        type,
        indent,
        order_index,
        content
      )
      values (
        gen_random_uuid(),
        ${pageId},
        ${null},
        ${'paragraph'},
        ${0},
        ${0},
        ${JSON.stringify({ text: '' })}
      )
    `;

    await sql`commit`;
  } catch (error) {
    await sql`rollback`;
    throw error;
  }

  redirect(`/p/${pageId}`);
};

export default async function HomePage() {
  if (!sql) {
    throw new Error('Database not configured.');
  }

  const user = await requireUser();
  const workspaceId = await getWorkspaceIdForUser(user.id);

  if (!workspaceId) {
    notFound();
  }

  const recentPages = await sql`
    select
      id,
      title,
      updated_at as "updatedAt",
      last_opened_at as "lastOpenedAt"
    from pages
    where workspace_id = ${workspaceId}
      and is_deleted = false
    order by last_opened_at desc nulls last, updated_at desc
    limit 20
  `;

  return (
    <div className="home">
      <div className="home-header">
        <div>
          <div className="badge">Recent</div>
          <h1>ホーム</h1>
          <p className="home-subtitle">
            最後に開いたメモへすぐ戻って編集できます。
          </p>
        </div>
        <form action={createNewPage}>
          <button className="button" type="submit">
            新規メモ
          </button>
        </form>
      </div>

      <section className="home-section">
        <h2 className="home-section__title">最近のメモ</h2>
        {recentPages.length === 0 ? (
          <div className="card home-empty">
            <p>まだメモがありません。右上の「新規メモ」を押してください。</p>
          </div>
        ) : (
          <div className="home-list">
            {recentPages.map((page) => (
              <Link key={page.id} className="home-list__item" href={`/p/${page.id}`}>
                <div className="home-list__title">
                  {page.title || DEFAULT_TITLE}
                </div>
                <div className="home-list__meta">
                  最終更新: {formatUpdatedAt(page.updatedAt ?? page.lastOpenedAt)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
