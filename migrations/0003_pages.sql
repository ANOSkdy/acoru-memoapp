create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  parent_page_id uuid,
  title text not null default '',
  is_favorite boolean not null default false,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  last_opened_at timestamptz,
  content_revision integer not null default 0,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pages_parent_not_self check (parent_page_id is null or parent_page_id <> id)
);

create index if not exists pages_ws_updated_idx on pages (workspace_id, updated_at desc, id desc);
create index if not exists pages_ws_last_opened_idx on pages (workspace_id, last_opened_at desc, id desc);
create index if not exists pages_ws_favorite_idx on pages (workspace_id, is_favorite, updated_at desc, id desc);
create index if not exists pages_ws_deleted_idx on pages (workspace_id, is_deleted, updated_at desc, id desc);
create index if not exists pages_ws_parent_idx on pages (workspace_id, parent_page_id);
