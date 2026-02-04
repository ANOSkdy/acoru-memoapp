import { notFound } from "next/navigation";

import PageEditor from "./PageEditor";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getWorkspaceIdForUser } from "@/lib/workspaces";

export const runtime = "nodejs";

type PageEditorPageProps = {
  params: { pageId: string };
};

export default async function PageEditorPage({
  params,
}: PageEditorPageProps) {
  if (!sql) {
    throw new Error("Database not configured.");
  }

  const user = await requireUser();
  const workspaceId = await getWorkspaceIdForUser(user.id);

  if (!workspaceId) {
    notFound();
  }

  const pageId = params.pageId;

  const pageRows = await sql`
    update pages
    set last_opened_at = now()
    where id = ${pageId}
      and workspace_id = ${workspaceId}
    returning
      id,
      title,
      content_revision as "contentRevision"
  `;

  if (pageRows.length === 0) {
    notFound();
  }

  const blocks = await sql`
    select
      id,
      page_id as "pageId",
      parent_block_id as "parentBlockId",
      type,
      indent,
      order_index as "orderIndex",
      content
    from blocks
    where page_id = ${pageId}
    order by order_index asc
  `;

  return (
    <PageEditor
      pageId={pageId}
      initialTitle={pageRows[0]?.title ?? ""}
      initialBlocks={blocks}
      initialRevision={pageRows[0]?.contentRevision ?? 0}
    />
  );
}
