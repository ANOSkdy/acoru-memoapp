create extension if not exists pgcrypto;

create table if not exists workspace_users (
  id text primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references workspace_users(id) on delete cascade,
  title text not null,
  body text not null,
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists note_tags (
  note_id uuid not null references notes(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (note_id, tag_id)
);

create index if not exists notes_user_id_idx on notes (user_id);
create index if not exists notes_favorite_idx on notes (is_favorite);
create index if not exists notes_updated_at_idx on notes (updated_at desc);
