create table if not exists pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  search_text text not null default '',
  content_revision integer not null default 0,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists page_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  type text not null,
  content jsonb not null default '{}'::jsonb,
  order_index integer not null,
  created_at timestamptz not null default now()
);

create index if not exists pages_user_id_idx on pages (user_id);
create index if not exists page_blocks_page_id_idx on page_blocks (page_id);
