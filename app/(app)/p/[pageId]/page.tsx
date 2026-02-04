import { notFound } from 'next/navigation';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { blockSchema, type BlockInput } from '@/lib/blocks';
import { sql } from '@/lib/db';

import Editor from './editor';

export const runtime = 'nodejs';

const pageIdSchema = z.string().uuid();

type PageEditorProps = {
  params: { pageId: string };
};

export default async function PageEditor({ params }: PageEditorProps) {
  const pageIdResult = pageIdSchema.safeParse(params.pageId);
  if (!pageIdResult.success) {
    notFound();
  }

  const user = await requireUser();

  if (!sql) {
    return (
      <div className="card">
        Database is not configured. Please set DATABASE_URL.
      </div>
    );
  }

  const pageRows = await sql`
    select
      id,
      title,
      content_revision as "contentRevision"
    from pages
    where id = ${pageIdResult.data}
      and user_id = ${user.id}
    limit 1
  `;

  if (pageRows.length === 0) {
    notFound();
  }

  const page = pageRows[0];

  const blockRows = await sql`
    select
      type,
      content,
      order_index as "orderIndex"
    from page_blocks
    where page_id = ${page.id}
    order by order_index asc
  `;

  const blocks: BlockInput[] = blockRows.map((row) => {
    const content = row.content ?? {};
    const parsed = blockSchema.safeParse({ type: row.type, ...content });
    if (parsed.success) {
      return parsed.data;
    }

    if (row.type === 'divider') {
      return { type: 'divider' };
    }

    return { type: 'paragraph', text: '' };
  });

  return (
    <Editor
      pageId={page.id}
      initialTitle={page.title}
      initialBlocks={blocks}
      initialRevision={page.contentRevision}
    />
  );
}
