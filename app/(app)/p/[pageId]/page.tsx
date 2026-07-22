import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import PageEditor from "./PageEditor";
import { requireSessionContext } from "@/lib/auth";
import { flatBlockSchema, type FlatBlock } from "@/lib/blocks";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

type PageEditorPageProps = {
  params: { pageId: string };
};

const blocksArraySchema = z.array(flatBlockSchema);

const normalizeBlockRows = (rawRows: unknown[]): FlatBlock[] => {
  const mapped = rawRows
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const record = row as Record<string, unknown>;
      const contentValue = record.content;
      let content: unknown = contentValue;

      if (typeof contentValue === "string") {
        try {
          content = JSON.parse(contentValue);
        } catch {
          content = contentValue;
        }
      }

      return {
        id: record.id,
        pageId: record.pageId ?? record.page_id,
        parentBlockId: record.parentBlockId ?? record.parent_block_id ?? null,
        type: record.type,
        indent: record.indent ?? 0,
        orderIndex: record.orderIndex ?? record.order_index ?? 0,
        content,
      };
    })
    .filter(Boolean);

  const parsed = blocksArraySchema.safeParse(mapped);
  return parsed.success ? parsed.data : [];
};

export default async function PageEditorPage({
  params,
}: PageEditorPageProps) {
  if (!sql) {
    throw new Error("Database not configured.");
  }

  const { workspaceId } = await requireSessionContext();

  if (!workspaceId) {
    notFound();
  }

  const pageId = params.pageId;

  // The page row and its blocks are independent reads: fetch them in parallel.
  const [pageInfoRows, blockRows] = await Promise.all([
    sql`
      select
        id,
        title,
        content_revision as "contentRevision",
        is_deleted as "isDeleted"
      from pages
      where id = ${pageId}
        and workspace_id = ${workspaceId}
    `,
    sql`
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
    `
  ]);

  if (pageInfoRows.length === 0) {
    notFound();
  }

  const pageInfo = pageInfoRows[0] as {
    id: string;
    title: string | null;
    contentRevision: number | null;
    isDeleted: boolean | null;
  };

  if (pageInfo.isDeleted) {
    redirect("/trash");
  }

  await sql`
    update pages
    set last_opened_at = now()
    where id = ${pageId}
      and workspace_id = ${workspaceId}
  `;

  const blocks = normalizeBlockRows(blockRows);

  return (
    <PageEditor
      pageId={pageId}
      initialTitle={pageInfo.title ?? ""}
      initialBlocks={blocks}
      initialRevision={pageInfo.contentRevision ?? 0}
    />
  );
}
