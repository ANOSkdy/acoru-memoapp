-- MANUAL RUN ONLY: optional backfill from notes -> pages.
-- Adjust workspace mapping before running in production.

do $$
declare
  target_workspace uuid;
begin
  if to_regclass('public.notes') is null then
    raise notice 'notes table not found, skipping backfill.';
    return;
  end if;

  if to_regclass('public.pages') is null then
    raise exception 'pages table not found. Run 0003_pages.sql first.';
  end if;

  if to_regclass('public.workspaces') is null then
    raise notice 'workspaces table not found. Provide a workspace_id mapping before backfill.';
    return;
  end if;

  select id into target_workspace
  from workspaces
  order by created_at asc
  limit 1;

  if target_workspace is null then
    raise notice 'no workspaces found. Create a workspace before backfill.';
    return;
  end if;

  insert into pages (
    id,
    workspace_id,
    parent_page_id,
    title,
    search_text,
    is_favorite,
    is_deleted,
    created_at,
    updated_at,
    last_opened_at
  )
  select
    n.id,
    target_workspace,
    null,
    n.title,
    n.body,
    n.is_favorite,
    n.is_archived,
    n.created_at,
    n.updated_at,
    n.updated_at
  from notes n
  where not exists (
    select 1
    from pages p
    where p.id = n.id
  );
end $$;
